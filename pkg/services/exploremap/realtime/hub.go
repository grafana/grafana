package realtime

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/exploremap"
	"github.com/grafana/grafana/pkg/services/exploremap/crdt"
	"github.com/grafana/grafana/pkg/services/live"
)

var logger = log.New("exploremap.realtime")

// Store interface for saving map snapshots
type Store interface {
	Update(ctx context.Context, cmd *exploremap.UpdateExploreMapCommand) (*exploremap.ExploreMapDTO, error)
	Get(ctx context.Context, query *exploremap.GetExploreMapByUIDQuery) (*exploremap.ExploreMapDTO, error)
}

// OperationHub manages real-time CRDT operations
type OperationHub struct {
	liveService *live.GrafanaLive
	store       Store
	states      *StateCache
	mu          sync.RWMutex
}

// StateCache holds in-memory CRDT states for active maps
type StateCache struct {
	states map[string]*MapState
	mu     sync.RWMutex
}

// MapState represents the CRDT state for a single map
type MapState struct {
	UID     string
	OrgID   int64
	Title   *crdt.LWWRegister
	Panels  *crdt.ORSet
	ZIndex  *crdt.PNCounter
	Updated time.Time
	mu      sync.RWMutex
}

// NewOperationHub creates a new operation hub
func NewOperationHub(liveService *live.GrafanaLive, store Store) *OperationHub {
	return &OperationHub{
		liveService: liveService,
		store:       store,
		states: &StateCache{
			states: make(map[string]*MapState),
		},
	}
}

// HandleOperation processes an incoming CRDT operation
func (h *OperationHub) HandleOperation(ctx context.Context, op crdt.Operation) error {
	// Get or create state
	state, err := h.states.GetOrCreate(op.MapUID)
	if err != nil {
		return fmt.Errorf("failed to get state: %w", err)
	}

	state.mu.Lock()
	defer state.mu.Unlock()

	// Apply operation to CRDT state
	if err := h.applyOperation(state, op); err != nil {
		return fmt.Errorf("failed to apply operation: %w", err)
	}

	state.Updated = time.Now()

	// Broadcast to all connected clients
	// Include grafana scope prefix to match subscription channel
	channel := fmt.Sprintf("grafana/explore-map/%s", op.MapUID)
	data, err := json.Marshal(op)
	if err != nil {
		return fmt.Errorf("failed to marshal operation: %w", err)
	}

	// TODO: Get actual orgID from map state or context
	// For now, use 1 as the orgID (Grafana default org)
	orgID := int64(1)
	if err := h.liveService.Publish(orgID, channel, data); err != nil {
		logger.Warn("Failed to broadcast operation", "error", err, "mapUid", op.MapUID, "channel", channel)
		return fmt.Errorf("failed to broadcast operation: %w", err)
	}

	return nil
}

// applyOperation applies a CRDT operation to the state
func (h *OperationHub) applyOperation(state *MapState, op crdt.Operation) error {
	payload, err := op.ParsePayload()
	if err != nil {
		return fmt.Errorf("failed to parse payload: %w", err)
	}

	switch op.Type {
	case crdt.OpAddPanel:
		p := payload.(crdt.AddPanelPayload)
		state.Panels.Add(p.PanelID, op.OperationID)
		// Allocate z-index
		state.ZIndex.Next(op.NodeID)

	case crdt.OpRemovePanel:
		p := payload.(crdt.RemovePanelPayload)
		state.Panels.Remove(p.PanelID, p.ObservedTags)

	case crdt.OpUpdateTitle:
		p := payload.(crdt.UpdateTitlePayload)
		state.Title.Set(p.Title, op.Timestamp)

	case crdt.OpBatch:
		p := payload.(crdt.BatchPayload)
		for _, subOp := range p.Operations {
			if err := h.applyOperation(state, subOp); err != nil {
				return err
			}
		}

	// Other operation types don't need special handling in the hub
	// They're applied at the client level
	}

	return nil
}

// GetState returns the current CRDT state for a map
func (h *OperationHub) GetState(ctx context.Context, mapUID string) (*MapState, error) {
	return h.states.GetOrCreate(mapUID)
}

// SnapshotState persists the current CRDT state to the database
func (h *OperationHub) SnapshotState(ctx context.Context, mapUID string) error {
	state, err := h.states.Get(mapUID)
	if err != nil {
		return err
	}

	state.mu.RLock()
	defer state.mu.RUnlock()

	// Skip if OrgID not set - map may not exist in database yet
	if state.OrgID == 0 {
		return exploremap.ErrExploreMapNotFound
	}
	orgID := state.OrgID

	// Serialize state to JSON
	stateData := map[string]interface{}{
		"title":  state.Title,
		"panels": state.Panels,
		"zIndex": state.ZIndex,
	}

	data, err := json.Marshal(stateData)
	if err != nil {
		return fmt.Errorf("failed to marshal state: %w", err)
	}

	// Update in database
	_, err = h.store.Update(ctx, &exploremap.UpdateExploreMapCommand{
		UID:   mapUID,
		OrgID: orgID,
		Data:  string(data),
	})
	return err
}

// StartSnapshotWorker starts a background worker that periodically snapshots states
func (h *OperationHub) StartSnapshotWorker(ctx context.Context, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			h.snapshotAll(ctx)
		case <-ctx.Done():
			return
		}
	}
}

func (h *OperationHub) snapshotAll(ctx context.Context) {
	h.states.mu.RLock()
	mapUIDs := make([]string, 0, len(h.states.states))
	for uid := range h.states.states {
		mapUIDs = append(mapUIDs, uid)
	}
	h.states.mu.RUnlock()

	for _, uid := range mapUIDs {
		if err := h.SnapshotState(ctx, uid); err != nil {
			// Ignore "not found" errors - map may have been deleted or not yet created
			if err != exploremap.ErrExploreMapNotFound {
				logger.Warn("Failed to snapshot state", "error", err, "mapUid", uid)
			}
		}
	}
}

// StateCache methods

func (sc *StateCache) Get(mapUID string) (*MapState, error) {
	sc.mu.RLock()
	defer sc.mu.RUnlock()

	state, exists := sc.states[mapUID]
	if !exists {
		return nil, fmt.Errorf("state not found for map: %s", mapUID)
	}

	return state, nil
}

func (sc *StateCache) GetOrCreate(mapUID string) (*MapState, error) {
	sc.mu.Lock()
	defer sc.mu.Unlock()

	state, exists := sc.states[mapUID]
	if !exists {
		// Create new state
		state = &MapState{
			UID:     mapUID,
			Title:   crdt.NewLWWRegister("Untitled Map", crdt.HLCTimestamp{}),
			Panels:  crdt.NewORSet(),
			ZIndex:  crdt.NewPNCounter(),
			Updated: time.Now(),
		}
		sc.states[mapUID] = state
	}

	return state, nil
}

func (sc *StateCache) Remove(mapUID string) {
	sc.mu.Lock()
	defer sc.mu.Unlock()
	delete(sc.states, mapUID)
}
