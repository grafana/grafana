package elastigo

type ClusterHealthResponse struct {
	ClusterName         string `json:"cluster_name"`
	Status              string `json:"status"`
	TimedOut            bool   `json:"timed_out"`
	NumberOfNodes       int    `json:"number_of_nodes"`
	NumberOfDataNodes   int    `json:"number_of_data_nodes"`
	ActivePrimaryShards int    `json:"active_primary_shards"`
	ActiveShards        int    `json:"active_shards"`
	RelocatingShards    int    `json:"relocating_shards"`
	InitializingShards  int    `json:"initializing_shards"`
	UnassignedShards    int    `json:"unassigned_shards"`
}

type ClusterStateResponse struct {
	ClusterName string                              `json:"cluster_name"`
	MasterNode  string                              `json:"master_node"`
	Nodes       map[string]ClusterStateNodeResponse `json:"nodes"`
	Metadata    ClusterStateMetadataResponse        `json:"metadata"`
	// TODO: Routing Table
	// TODO: Routing Nodes
	// TODO: Allocations

}

type ClusterStateNodeResponse struct {
	Name             string `json:"name"`
	TransportAddress string `json:"transport_address"`
	// TODO: Attributes
}

type ClusterStateMetadataResponse struct {
	// TODO: templates
	Indices map[string]ClusterStateIndiceResponse `json:"indices"`
}

type ClusterStateIndiceResponse struct {
	State string `json:"state"`
}

type ClusterStateRoutingTableResponse struct {
	// TODO: unassigned
	//
}
