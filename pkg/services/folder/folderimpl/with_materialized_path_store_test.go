package folderimpl

import (
	"testing"

	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/stretchr/testify/require"
)

func TestIntegrationMaterializedPathStore(t *testing.T) {
	db := sqlstore.InitTestDB(t)
	orgID := createOrg(t, db)
	folderStore, err := ProvideMaterializedPathStore(db)
	require.NoError(t, err)

	testIntegrationStore(t, folderStore, orgID)
}
