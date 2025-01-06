package fake_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/libraryelements/fake"
	"github.com/grafana/grafana/pkg/services/libraryelements/model"
)

func TestLibraryElementService(t *testing.T) {
	t.Parallel()

	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)

	t.Run("GetElement", func(t *testing.T) {
		t.Parallel()

		user := &identity.StaticRequester{}

		t.Run("when the element does not exist, it returns a `model.ErrLibraryElementNotFound` error", func(t *testing.T) {
			t.Parallel()

			svc := &fake.LibraryElementService{}

			element, err := svc.GetElement(ctx, user, model.GetLibraryElementCommand{UID: "does-not-exist"})
			require.ErrorIs(t, err, model.ErrLibraryElementNotFound)
			require.Empty(t, element)
		})

		t.Run("when the element exists, it returns it", func(t *testing.T) {
			t.Parallel()

			svc := &fake.LibraryElementService{}

			uid := "uid-1"

			createdElement, err := svc.CreateElement(ctx, user, model.CreateLibraryElementCommand{
				Name:  "ElementName",
				Model: []byte{},
				Kind:  int64(model.PanelElement),
				UID:   uid,
			})
			require.NoError(t, err)
			require.NotEmpty(t, createdElement)

			element, err := svc.GetElement(ctx, user, model.GetLibraryElementCommand{UID: uid})
			require.NoError(t, err)
			require.EqualValues(t, element, createdElement)
		})
	})

	t.Run("CreateElement", func(t *testing.T) {
		t.Parallel()

		user := &identity.StaticRequester{}

		t.Run("when the uid already exists, it returns a `model.ErrLibraryElementAlreadyExists` error", func(t *testing.T) {
			t.Parallel()

			svc := &fake.LibraryElementService{}

			cmd := model.CreateLibraryElementCommand{
				Name:  "ElementName",
				Model: []byte{},
				Kind:  int64(model.PanelElement),
				UID:   "uid-1",
			}

			createdElement, err := svc.CreateElement(ctx, user, cmd)
			require.NoError(t, err)
			require.NotEmpty(t, createdElement)

			createdElement, err = svc.CreateElement(ctx, user, cmd)
			require.ErrorIs(t, err, model.ErrLibraryElementAlreadyExists)
			require.Empty(t, createdElement)
		})

		t.Run("when the uid is not passed in, it generates a new one", func(t *testing.T) {
			t.Parallel()

			svc := &fake.LibraryElementService{}

			cmd := model.CreateLibraryElementCommand{
				Name:  "ElementName",
				Model: []byte{},
				Kind:  int64(model.PanelElement),
			}

			createdElement, err := svc.CreateElement(ctx, user, cmd)
			require.NoError(t, err)
			require.NotEmpty(t, createdElement)
			require.NotEmpty(t, createdElement.UID)
		})
	})

	t.Run("GetAllElements", func(t *testing.T) {
		t.Parallel()

		t.Run("only returns the elements belonging to the requestor org", func(t *testing.T) {
			t.Parallel()

			user1 := &identity.StaticRequester{OrgID: 1}
			user2 := &identity.StaticRequester{OrgID: 2}

			svc := &fake.LibraryElementService{}

			cmd := model.CreateLibraryElementCommand{
				Name:  "ElementName",
				Model: []byte{},
				Kind:  int64(model.PanelElement),
			}

			createdElement1, err := svc.CreateElement(ctx, user1, cmd)
			require.NoError(t, err)
			require.NotEmpty(t, createdElement1)

			createdElement2, err := svc.CreateElement(ctx, user2, cmd)
			require.NoError(t, err)
			require.NotEmpty(t, createdElement2)

			result, err := svc.GetAllElements(ctx, user2, model.SearchLibraryElementsQuery{})
			require.NoError(t, err)
			require.Len(t, result.Elements, 1)
			require.Equal(t, createdElement2.UID, result.Elements[0].UID)
		})
	})
}
