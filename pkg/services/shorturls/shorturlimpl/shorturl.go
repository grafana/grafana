package shorturlimpl

import (
	"context"
	"crypto/sha256"
	"fmt"
	"net/url"
	"path"
	"sort"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/shorturls"
	"github.com/grafana/grafana/pkg/util"
)

var getTime = time.Now

// normalizeTimeParam normalizes absolute timestamps to relative ranges when possible.
// If both from and to are recent absolute timestamps (within last 24h), it normalizes them
// to a relative representation based on their offset from now.
func normalizeTimeParam(paramName, paramValue string, now time.Time) string {
	// Try to parse as ISO timestamp
	t, err := time.Parse(time.RFC3339, paramValue)
	if err != nil {
		// Try parsing with nanoseconds
		t, err = time.Parse(time.RFC3339Nano, paramValue)
		if err != nil {
			// Not an ISO timestamp, return as-is (might be relative like "now-6h")
			return paramValue
		}
	}

	// Only normalize timestamps from the last 24 hours
	// This prevents normalizing old absolute timestamps that should stay absolute
	if t.Before(now.Add(-24 * time.Hour)) {
		return paramValue
	}

	// Calculate offset from now
	offset := now.Sub(t)

	// For "to" parameter, it might be at or slightly after now
	// For "from" parameter, it's typically before now
	// Handle both cases
	if offset >= 0 {
		// t is in the past or at now
		offsetMinutes := int(offset.Minutes())
		if offsetMinutes == 0 {
			return "now"
		}
		// Convert to relative format
		if offsetMinutes < 60 {
			return fmt.Sprintf("now-%dm", offsetMinutes)
		} else if offsetMinutes < 1440 { // 24 hours
			hours := offsetMinutes / 60
			return fmt.Sprintf("now-%dh", hours)
		}
		// For longer offsets, keep as absolute timestamp but round to minute precision
		return t.Truncate(time.Minute).Format(time.RFC3339)
	} else {
		// t is in the future (shouldn't happen for "from", but might for "to")
		// If very close to now (within 1 minute), normalize to "now"
		futureOffset := -offset
		if futureOffset < time.Minute {
			return "now"
		}
		// Otherwise keep as absolute timestamp
		return t.Truncate(time.Minute).Format(time.RFC3339)
	}
}

// normalizePath normalizes a URL path by sorting query parameters alphabetically
// and normalizing recent absolute timestamps to relative ranges.
func normalizePath(pathStr string) string {
	// Try to parse as URL to separate path and query
	parsedURL, err := url.Parse(pathStr)
	if err != nil {
		// If parsing fails, return as-is (no query params to normalize)
		return pathStr
	}

	// If no query parameters, return path as-is
	if parsedURL.RawQuery == "" {
		return pathStr
	}

	// Parse query parameters
	values := parsedURL.Query()

	// Normalize time parameters if present
	now := getTime()

	// If "to" is present and very close to now (within 5 minutes), use it as the reference point
	// This handles the case where "to" represents "now" at the time the URL was created
	var referenceTime = now
	if toVal, hasTo := values["to"]; hasTo && len(toVal) > 0 {
		if toTime, err := time.Parse(time.RFC3339, toVal[0]); err == nil {
			// Try with nanoseconds too
			if err != nil {
				toTime, err = time.Parse(time.RFC3339Nano, toVal[0])
			}
			if err == nil {
				// If "to" is within 5 minutes of now (past or future), use it as reference
				// This means the URL was created recently and "to" represents "now"
				timeDiff := now.Sub(toTime)
				if timeDiff < 5*time.Minute && timeDiff > -5*time.Minute {
					referenceTime = toTime
				}
			}
		}
	}

	if fromVal, hasFrom := values["from"]; hasFrom && len(fromVal) > 0 {
		normalized := normalizeTimeParam("from", fromVal[0], referenceTime)
		values["from"] = []string{normalized}
	}
	if toVal, hasTo := values["to"]; hasTo && len(toVal) > 0 {
		normalized := normalizeTimeParam("to", toVal[0], referenceTime)
		values["to"] = []string{normalized}
	}

	// Sort keys for consistent ordering
	keys := make([]string, 0, len(values))
	for k := range values {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	// Rebuild query string with sorted keys
	var queryParts []string
	for _, k := range keys {
		// Sort values for each key as well (in case of multiple values)
		vals := values[k]
		sort.Strings(vals)
		for _, v := range vals {
			queryParts = append(queryParts, fmt.Sprintf("%s=%s", url.QueryEscape(k), url.QueryEscape(v)))
		}
	}

	// Reconstruct normalized path
	normalizedQuery := strings.Join(queryParts, "&")
	parsedURL.RawQuery = normalizedQuery
	return parsedURL.String()
}

// generateSignature creates a SHA256 hash of orgID and normalized path
// to enable de-duplication of short URLs.
func generateSignature(orgID int64, pathStr string) string {
	normalizedPath := normalizePath(pathStr)
	input := fmt.Sprintf("%d:%s", orgID, normalizedPath)
	hash := sha256.Sum256([]byte(input))
	return fmt.Sprintf("%x", hash)
}

type ShortURLService struct {
	SQLStore store
}

func ProvideService(db db.DB) *ShortURLService {
	return &ShortURLService{
		SQLStore: &sqlStore{
			db: db,
		},
	}
}

func (s ShortURLService) GetShortURLByUID(ctx context.Context, user identity.Requester, uid string) (*shorturls.ShortUrl, error) {
	return s.SQLStore.Get(ctx, user, uid)
}

func (s ShortURLService) UpdateLastSeenAt(ctx context.Context, shortURL *shorturls.ShortUrl) error {
	return s.SQLStore.Update(ctx, shortURL)
}

func (s ShortURLService) List(ctx context.Context, orgID int64) ([]*shorturls.ShortUrl, error) {
	return s.SQLStore.List(ctx, orgID)
}

func (s ShortURLService) CreateShortURL(ctx context.Context, user identity.Requester, cmd *dtos.CreateShortURLCmd) (*shorturls.ShortUrl, error) {
	relPath := strings.TrimSpace(cmd.Path)

	if path.IsAbs(relPath) {
		return nil, shorturls.ErrShortURLAbsolutePath.Errorf("expected relative path: %s", relPath)
	}
	if strings.Contains(relPath, "../") {
		return nil, shorturls.ErrShortURLInvalidPath.Errorf("path cannot contain '../': %s", relPath)
	}

	orgID := user.GetOrgID()

	// Generate signature for de-duplication
	// If UID is provided, include it in signature to make it unique per UID (bypasses de-duplication)
	// If UID is not provided, signature is based on path only (enables de-duplication)
	var signature string
	if cmd.UID == "" {
		signature = generateSignature(orgID, relPath)

		// Check if a short URL with the same signature already exists
		existingShortURL, err := s.SQLStore.GetBySignature(ctx, orgID, signature)
		if err != nil {
			if !shorturls.ErrShortURLNotFound.Is(err) {
				return nil, shorturls.ErrShortURLInternal.Errorf("failed to check existing short URL by signature: %w", err)
			}
			// Not found, continue to create new one
		} else if existingShortURL != nil {
			// Found existing short URL with same signature, update LastSeenAt and return it
			if err := s.SQLStore.Update(ctx, existingShortURL); err != nil {
				return nil, shorturls.ErrShortURLInternal.Errorf("failed to update existing short URL: %w", err)
			}
			return existingShortURL, nil
		}
	} else {
		// Include UID in signature to make it unique per custom UID
		signature = generateSignature(orgID, relPath+":"+cmd.UID)
	}

	uid := cmd.UID
	if uid == "" {
		uid = util.GenerateShortUID()
	} else {
		// Ensure the UID is valid
		if !util.IsValidShortUID(uid) {
			return nil, shorturls.ErrShortURLBadRequest.Errorf("invalid UID: %s", uid)
		}

		// Check if the UID already exists
		existingShortURL, err := s.SQLStore.Get(ctx, user, uid)
		if err != nil {
			if !shorturls.ErrShortURLNotFound.Is(err) {
				return nil, shorturls.ErrShortURLInternal.Errorf("failed to check existing short URL: %w", err)
			}
		}
		if existingShortURL != nil {
			// If the UID already exists, we return an error
			return nil, shorturls.ErrShortURLConflict.Errorf("short URL with UID '%s' already exists", uid)
		}
	}

	now := time.Now().Unix()
	shortURL := shorturls.ShortUrl{
		OrgId:     orgID,
		Uid:       uid,
		Path:      relPath,
		Signature: signature,
		CreatedAt: now,
	}
	shortURL.CreatedBy, _ = user.GetInternalID()

	if err := s.SQLStore.Insert(ctx, &shortURL); err != nil {
		// Handle potential race condition: if unique constraint violation on (org_id, signature)
		// another request may have created the same short URL concurrently
		if cmd.UID == "" && signature != "" {
			// Check again if it was created by another request
			existingShortURL, retryErr := s.SQLStore.GetBySignature(ctx, orgID, signature)
			if retryErr == nil && existingShortURL != nil {
				// Found it, update LastSeenAt and return it
				if updateErr := s.SQLStore.Update(ctx, existingShortURL); updateErr != nil {
					return nil, shorturls.ErrShortURLInternal.Errorf("failed to update existing short URL after race condition: %w", updateErr)
				}
				return existingShortURL, nil
			}
		}
		return nil, shorturls.ErrShortURLInternal.Errorf("failed to insert shorturl: %w", err)
	}

	return &shortURL, nil
}

func (s ShortURLService) DeleteStaleShortURLs(ctx context.Context, cmd *shorturls.DeleteShortUrlCommand) error {
	return s.SQLStore.Delete(ctx, cmd)
}

func (s ShortURLService) ConvertShortURLToDTO(shortURL *shorturls.ShortUrl, appURL string) *dtos.ShortURL {
	url := fmt.Sprintf("%s/goto/%s?orgId=%d", strings.TrimSuffix(appURL, "/"), shortURL.Uid, shortURL.OrgId)

	return &dtos.ShortURL{
		UID: shortURL.Uid,
		URL: url,
	}
}
