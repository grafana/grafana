package prefimpl

import (
	"context"
	"fmt"
	"sort"

	pref "github.com/grafana/grafana/pkg/services/preference"
)

// preferenceKey represents the primarily used index to access
// preferences.
//
// Preferences are typically either addressed by just OrgID;
// OrgID and UserID; or OrgID and UserID. Since all these IDs are one
// or more, using zero to represent "not relevant" replicates how the
// equivalent database index is structured.
type preferenceKey struct {
	OrgID  int64
	TeamID int64
	UserID int64
}

// inmemStore implements an implementation of store appropriate for
// testing without needing a full SQL database.
type inmemStore struct {
	preference map[preferenceKey]pref.Preference
	idMap      map[int64]preferenceKey
	nextID     int64
}

func (s *inmemStore) Get(ctx context.Context, preference *pref.Preference) (*pref.Preference, error) {
	res, ok := s.preference[preferenceKey{
		OrgID:  preference.OrgID,
		TeamID: preference.TeamID,
		UserID: preference.UserID,
	}]
	if !ok {
		return nil, pref.ErrPrefNotFound
	}

	return &res, nil
}

// List returns, in order, preferences relevant to the Organization,
// Org+Teams, and Org+User from the preference argument. The order is
// important, since later elements will override earlier when used
// in GetWithDefaults.
//
// Global preferences are not stored in the storage, but rather in the
// settings.Cfg structure, and are not returned by List.
func (s *inmemStore) List(ctx context.Context, preference *pref.Preference) ([]*pref.Preference, error) {
	res := []*pref.Preference{}

	// Org
	p, ok := s.preference[preferenceKey{
		OrgID: preference.OrgID,
	}]
	if ok {
		res = append(res, &p)
	}

	// Org + Teams (teams are numerically ordered)
	sort.Slice(preference.Teams, func(i, j int) bool {
		return preference.Teams[i] < preference.Teams[j]
	})

	for _, t := range preference.Teams {
		p, ok := s.preference[preferenceKey{
			OrgID:  preference.OrgID,
			TeamID: t,
		}]
		if !ok {
			continue
		}

		res = append(res, &p)
	}

	// Org + UserID
	if preference.UserID != 0 { // avoid adding the org preferences twice
		p, ok := s.preference[preferenceKey{
			OrgID:  preference.OrgID,
			UserID: preference.UserID,
		}]
		if ok {
			res = append(res, &p)
		}
	}

	return res, nil
}

func (s *inmemStore) Insert(ctx context.Context, preference *pref.Preference) (int64, error) {
	key := preferenceKey{
		OrgID:  preference.OrgID,
		TeamID: preference.TeamID,
		UserID: preference.UserID,
	}

	var p = *preference
	p.ID = s.nextID
	s.nextID++

	if _, exists := s.preference[key]; exists {
		return 0, fmt.Errorf("conflict in fake, preference for [orgid=%d, userid=%d, teamid=%d] already exists", preference.OrgID, preference.UserID, preference.TeamID)
	}

	s.preference[key] = p
	s.idMap[p.ID] = key
	return p.ID, nil
}

func (s *inmemStore) Update(ctx context.Context, preference *pref.Preference) error {
	key, ok := s.idMap[preference.ID]
	if !ok {
		return pref.ErrPrefNotFound
	}

	s.preference[key] = *preference
	return nil
}

func (s *inmemStore) DeleteByUser(ctx context.Context, userID int64) error {
	panic("not yet implemented")
}
