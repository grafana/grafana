package v0alpha1

ResourcePermission: {
	#Resource: {
		// api group of the resource (e.g: "folder.grafana.app")
		apiGroup: string
		// kind of the resource (e.g: "folders")
		resource: string
		// uid of the resource (e.g: "fold1")
		name: string
	}
	#Permission: {
		// kind of the identity getting the permission
		kind: "User" | "ServiceAccount" | "Team" | "BasicRole" 
		// uid of the identity getting the permission
		name: string
		// action set granted to the user (e.g. "admin" or "edit", "view")
		verb: string
	}
	
	resource: #Resource
	permissions: [...#Permission]
}
