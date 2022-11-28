package navtreeimpl

import (
	"github.com/grafana/grafana/pkg/services/navtree"
	"github.com/grafana/grafana/pkg/setting"
)

// @PERCONA
func AddPerconaRoutes() []*navtree.NavLink {
	var navTree []*navtree.NavLink

	systemChildNavs := []*navtree.NavLink{
		{Text: "Overview", Id: "node-overview", Url: setting.AppSubUrl + "/d/node-instance-overview/nodes-overview", Icon: "percona-nav-overview", HideFromTabs: true, ShowIconInNavbar: true},
		{Text: "Summary", Id: "node-summary", Url: setting.AppSubUrl + "/d/node-instance-summary/node-summary", Icon: "percona-nav-summary", HideFromTabs: true, ShowIconInNavbar: true},
		{Text: "CPU utilization", Id: "cpu-utilization", Url: setting.AppSubUrl + "/d/node-cpu/cpu-utilization-details", Icon: "percona-cpu", HideFromTabs: true},
		{Text: "Disk", Id: "disk", Url: setting.AppSubUrl + "/d/node-disk/disk-details", Icon: "percona-disk", HideFromTabs: true},
		{Text: "Memory", Id: "memory", Url: setting.AppSubUrl + "/d/node-memory/memory-details", Icon: "percona-memory", HideFromTabs: true},
		{Text: "Network", Id: "network", Url: setting.AppSubUrl + "/d/node-network/network-details", Icon: "percona-network", HideFromTabs: true},
		{Text: "Temperature", Id: "temperature", Url: setting.AppSubUrl + "/d/node-temp/node-temperature-details", Icon: "percona-temperature", HideFromTabs: true},
		{Text: "NUMA", Id: "numa", Url: setting.AppSubUrl + "/d/node-memory-numa/numa-details", Icon: "percona-cluster-network", HideFromTabs: true},
		{Text: "Processes", Id: "processes", Url: setting.AppSubUrl + "/d/node-cpu-process/processes-details", Icon: "percona-process", HideFromTabs: true},
	}

	mysqlHAChildNavs := []*navtree.NavLink{
		{Text: "Group replication summary", Id: "mysql-group-replication-summary", Url: setting.AppSubUrl + "/d/mysql-group-replicaset-summary/mysql-group-replication-summary", Icon: "percona-cluster", HideFromTabs: true},
		{Text: "Replication summary", Id: "mysql-replication-summary", Url: setting.AppSubUrl + "/d/mysql-replicaset-summary/mysql-replication-summary", Icon: "percona-cluster", HideFromTabs: true},
		{Text: "PXC/Galera cluster summary", Id: "pxc-cluster-summary", Url: setting.AppSubUrl + "/d/pxc-cluster-summary/pxc-galera-cluster-summary", Icon: "percona-cluster", HideFromTabs: true},
		{Text: "PXC/Galera node summary", Id: "pxc-node-summary", Url: setting.AppSubUrl + "/d/pxc-node-summary/pxc-galera-node-summary", Icon: "percona-cluster", HideFromTabs: true},
		{Text: "PXC/Galera nodes compare", Id: "pxc-nodes-compare", Url: setting.AppSubUrl + "/d/pxc-nodes-compare/pxc-galera-nodes-compare", Icon: "percona-cluster", HideFromTabs: true},
	}

	mysqlChildNavs := []*navtree.NavLink{
		{
			Text: "Overview",
			Id:   "mysql-overview",
			Url:  setting.AppSubUrl + "/d/mysql-instance-overview/mysql-instances-overview", Icon: "percona-nav-overview",
			HideFromTabs:     true,
			ShowIconInNavbar: true,
		},
		{
			Text: "Summary",
			Id:   "mysql-summary",
			Url:  setting.AppSubUrl + "/d/mysql-instance-summary/mysql-instance-summary", Icon: "percona-nav-summary",
			HideFromTabs:     true,
			ShowIconInNavbar: true,
		},
		{
			Text:             "High availability",
			Id:               "mysql-ha",
			Icon:             "percona-cluster",
			HideFromTabs:     true,
			ShowIconInNavbar: true,
			Children:         mysqlHAChildNavs,
		},
		{
			Text: "Command/Handler counters compare",
			Id:   "mysql-command-handler-counters-compare",
			Url:  setting.AppSubUrl + "/d/mysql-commandhandler-compare/mysql-command-handler-counters-compare",
			Icon: "sitemap",
		},
		{
			Text: "InnoDB details",
			Id:   "mysql-innodb-details",
			Url:  setting.AppSubUrl + "/d/mysql-innodb/mysql-innodb-details",
			Icon: "sitemap",
		},
		{
			Text: "InnoDB compression",
			Id:   "mysql-innodb-compression-details",
			Url:  setting.AppSubUrl + "/d/mysql-innodb-compression/mysql-innodb-compression-details",
			Icon: "sitemap",
		},
		{
			Text: "Performance schema",
			Id:   "mysql-performance-schema-details",
			Url:  setting.AppSubUrl + "/d/mysql-performance-schema/mysql-performance-schema-details",
			Icon: "sitemap",
		},
		{
			Text: "Query response time",
			Id:   "mysql-query-response-time-details",
			Url:  setting.AppSubUrl + "/d/mysql-queryresponsetime/mysql-query-response-time-details",
			Icon: "sitemap",
		},
		{
			Text: "Table details",
			Id:   "mysql-table-details",
			Url:  setting.AppSubUrl + "/d/mysql-table/mysql-table-details",
			Icon: "sitemap",
		},
		{
			Text: "TokuDB details",
			Id:   "mysql-tokudb-details",
			Url:  setting.AppSubUrl + "/d/mysql-tokudb/mysql-tokudb-details",
			Icon: "sitemap",
		},
	}

	mongodbHAChildNavs := []*navtree.NavLink{
		{Text: "Cluster summary", Id: "mongo-cluster-summary", Url: setting.AppSubUrl + "/d/mongodb-cluster-summary/mongodb-cluster-summary", Icon: "percona-cluster", HideFromTabs: true},
		{Text: "ReplSet summary", Id: "mongo-rplset-summary", Url: setting.AppSubUrl + "/d/mongodb-replicaset-summary/mongodb-replset-summary", Icon: "percona-cluster", HideFromTabs: true},
	}

	mongodbChildNavs := []*navtree.NavLink{
		{Text: "Overview", Id: "mongo-overview", Url: setting.AppSubUrl + "/d/mongodb-instance-overview/mongodb-instances-overview", Icon: "percona-nav-overview", HideFromTabs: true, ShowIconInNavbar: true},
		{Text: "Summary", Id: "mongo-summary", Url: setting.AppSubUrl + "/d/mongodb-instance-summary/mongodb-instance-summary", Icon: "percona-nav-summary", HideFromTabs: true, ShowIconInNavbar: true},
		{Text: "High availability", Id: "mongo-ha", Icon: "percona-cluster", HideFromTabs: true, Children: mongodbHAChildNavs, ShowIconInNavbar: true},
		{Text: "InMemory", Id: "mongo-memory-details", Url: setting.AppSubUrl + "/d/mongodb-inmemory/mongodb-inmemory-details", Icon: "sitemap", HideFromTabs: true},
		{Text: "MMAPv1", Id: "mongo-mmap-details", Url: setting.AppSubUrl + "/d/mongodb-mmapv1/mongodb-mmapv1-details", Icon: "sitemap", HideFromTabs: true},
		{Text: "WiredTiger", Id: "mondo-wiredtiger-details", Url: setting.AppSubUrl + "/d/mongodb-wiredtiger/mongodb-wiredtiger-details", Icon: "sitemap", HideFromTabs: true},
	}

	postgresqlChildNavs := []*navtree.NavLink{
		// 		{Text: "HA (High availability)", Id: "postgres-ha", Icon: "percona-cluster", HideFromTabs: true, ShowIconInNavbar: true},
		{Text: "Overview", Id: "postgre-overwiew", Url: setting.AppSubUrl + "/d/postgresql-instance-overview/postgresql-instances-overview", Icon: "percona-nav-overview", HideFromTabs: true, ShowIconInNavbar: true},
		{Text: "Summary", Id: "postgre-summary", Url: setting.AppSubUrl + "/d/postgresql-instance-summary/postgresql-instance-summary", Icon: "percona-nav-summary", HideFromTabs: true, ShowIconInNavbar: true},
	}

	navTree = append(navTree, &navtree.NavLink{
		Text:             "Operating System (OS)",
		Id:               "system",
		Url:              setting.AppSubUrl + "/d/node-instance-overview/nodes-overview",
		Icon:             "percona-system",
		HideFromTabs:     true,
		Children:         systemChildNavs,
		ShowIconInNavbar: true,
		SortWeight:       navtree.WeightDashboard,
		Section:          navtree.NavSectionCore,
	})

	navTree = append(navTree, &navtree.NavLink{
		Text:             "MySQL",
		Id:               "mysql",
		Url:              setting.AppSubUrl + "/d/mysql-instance-overview/mysql-instances-overview",
		Icon:             "percona-database-mysql",
		HideFromTabs:     true,
		Children:         mysqlChildNavs,
		ShowIconInNavbar: true,
		SortWeight:       navtree.WeightDashboard,
		Section:          navtree.NavSectionCore,
	})

	navTree = append(navTree, &navtree.NavLink{
		Text:             "MongoDB",
		Id:               "mongo",
		Url:              setting.AppSubUrl + "/d/mongodb-instance-overview/mongodb-instances-overview",
		Icon:             "percona-database-mongodb",
		HideFromTabs:     true,
		Children:         mongodbChildNavs,
		ShowIconInNavbar: true,
		SortWeight:       navtree.WeightDashboard,
		Section:          navtree.NavSectionCore,
	})

	navTree = append(navTree, &navtree.NavLink{
		Text:             "PostgreSQL",
		Id:               "postgre",
		Url:              setting.AppSubUrl + "/d/postgresql-instance-overview/postgresql-instances-overview",
		Icon:             "percona-database-postgresql",
		HideFromTabs:     true,
		Children:         postgresqlChildNavs,
		ShowIconInNavbar: true,
		SortWeight:       navtree.WeightDashboard,
		Section:          navtree.NavSectionCore,
	})

	navTree = append(navTree, &navtree.NavLink{
		Text:             "ProxySQL",
		Id:               "proxysql",
		Url:              setting.AppSubUrl + "/d/proxysql-instance-summary/proxysql-instance-summary",
		Icon:             "percona-database-proxysql",
		HideFromTabs:     true,
		ShowIconInNavbar: true,
		SortWeight:       navtree.WeightDashboard,
		Section:          navtree.NavSectionCore,
	})

	navTree = append(navTree, &navtree.NavLink{
		Text: "HAProxy", Id: "haproxy",
		Url:              setting.AppSubUrl + "/d/haproxy-instance-summary/haproxy-instance-summary",
		Icon:             "percona-database-haproxy",
		HideFromTabs:     true,
		ShowIconInNavbar: true,
		SortWeight:       navtree.WeightDashboard,
		Section:          navtree.NavSectionCore,
	})

	// QAN
	navTree = append(navTree, &navtree.NavLink{
		Text:         "Query Analytics (QAN)",
		Id:           "qan",
		Icon:         "qan-logo",
		Url:          setting.AppSubUrl + "/d/pmm-qan/pmm-query-analytics",
		SortWeight:   navtree.WeightDashboard,
		Section:      navtree.NavSectionCore,
		HideFromTabs: true,
	})

	return navTree
}
