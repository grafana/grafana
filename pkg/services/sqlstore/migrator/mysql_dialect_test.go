package migrator

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestExtractStatementsPreservesMySQLConditionalComments(t *testing.T) {
	schema := `
-- Table structure for table alert
/*!40101 SET @saved_cs_client = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE alert (
  id bigint NOT NULL
);
/*!40101 SET character_set_client = @saved_cs_client */;
`

	require.Equal(t, []string{
		"/*!40101 SET @saved_cs_client = @@character_set_client */",
		"/*!50503 SET character_set_client = utf8mb4 */",
		"CREATE TABLE alert (\nid bigint NOT NULL\n)",
		"/*!40101 SET character_set_client = @saved_cs_client */",
	}, extractStatements(schema))
}
