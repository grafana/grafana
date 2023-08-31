package vector

import "fmt"

var (
	CoreCollectionPrefix      = "grafana-core-"
	CoreCollectionAlertRules  = fmt.Sprintf("%salert-rules", CoreCollectionPrefix)
	CoreCollectionDashboards  = fmt.Sprintf("%sdashboards", CoreCollectionPrefix)
	CoreCollectionDatasources = fmt.Sprintf("%sdatasources", CoreCollectionPrefix)
	CoreCollectionFolders     = fmt.Sprintf("%sfolders", CoreCollectionPrefix)
)
