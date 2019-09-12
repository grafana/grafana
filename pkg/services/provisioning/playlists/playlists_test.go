package playlists

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	m "github.com/grafana/grafana/pkg/models"
)

const (
	testNewPlaylistsMultipleFiles = "testdata/testNewPlaylistsMultipleFiles"
	testWithExistingPlaylists     = "testdata/testWithExistingPlaylists"
)

var (
	logger log.Logger = log.New("fake.log")

	fakeRepo *fakeRepository
)

func initTests() {
	fakeRepo = &fakeRepository{}
	bus.ClearBusHandlers()
	bus.AddHandler("test", mockCreate)
	bus.AddHandler("test", mockDelete)
	bus.AddHandler("test", mockUpdate)
	bus.AddHandler("test", mockGet)
}

func TestNewPlaylistsMultipleFiles(t *testing.T) {
	initTests()

	dc := newPlaylistProvisioner(logger)
	err := dc.applyChanges(testNewPlaylistsMultipleFiles)
	assert.Nil(t, err)
	assert.Len(t, fakeRepo.created, 3)
	assert.Len(t, fakeRepo.deleted, 0)
	assert.Len(t, fakeRepo.updated, 0)

	assert.Contains(t, fakeRepo.created, &m.CreatePlaylistCommand{
		Uid:      "px",
		Name:     "Other playlist",
		Interval: "15s",
		OrgId:    1,
		Items: []m.PlaylistItemDTO{
			{
				Type:  "dashboard_by_tag",
				Title: "Tag 1",
				Value: "tag1",
				Order: 1,
			},
			{
				Type:  "dashboard_by_tag",
				Title: "Tag 2",
				Value: "tag2",
				Order: 2,
			},
		},
	})
}

func TestWithExistingPlaylists(t *testing.T) {
	initTests()
	fakeRepo.loadAll = []*m.Playlist{
		{Uid: "p1", OrgId: 1},
		{Uid: "p2", OrgId: 2},
		{Uid: "p3", OrgId: 1},
		{Uid: "p4", OrgId: 1},
	}

	dc := newPlaylistProvisioner(logger)
	err := dc.applyChanges(testWithExistingPlaylists)
	assert.Nil(t, err)
	assert.Len(t, fakeRepo.created, 1)
	assert.Len(t, fakeRepo.deleted, 2)
	assert.Len(t, fakeRepo.updated, 1)
}

type fakeRepository struct {
	created []*m.CreatePlaylistCommand
	deleted []*m.DeletePlaylistWithUidCommand
	updated []*m.UpdatePlaylistWithUidCommand

	loadAll []*m.Playlist
}

func mockCreate(cmd *m.CreatePlaylistCommand) error {
	fakeRepo.created = append(fakeRepo.created, cmd)
	return nil
}

func mockDelete(cmd *m.DeletePlaylistWithUidCommand) error {
	fakeRepo.deleted = append(fakeRepo.deleted, cmd)
	return nil
}

func mockUpdate(cmd *m.UpdatePlaylistWithUidCommand) error {
	fakeRepo.updated = append(fakeRepo.updated, cmd)
	return nil
}

func mockGet(cmd *m.GetPlaylistByUidQuery) error {
	for _, v := range fakeRepo.loadAll {
		if cmd.Uid == v.Uid && cmd.OrgId == v.OrgId {
			cmd.Result = v
			return nil
		}
	}

	return nil
}
