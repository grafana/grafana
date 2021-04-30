+++
title = "Custom roles"
description = "Understand custom roles in access control"
keywords = ["grafana", "access-control", "concepts", "roles", "custom-roles" "enterprise"]
+++

## Custom roles
You can create custom roles and map permissions to those roles, to manage granular access for users the way you want. 
A custom role must have a name, description and version. You can manage custom roles using an API and associate permissions to them.

### Name of the role
The name of a custom role can’t start with “grafana:roles:” prefix, as it is reserved for predefined roles created by the Grafana Enterprise.

### Version of the role
The version of is a numeric value specifying the current version of the role. If you want to update the role you must increment the version number first, otherwise the update will fail. This is done to prevent accidental changes and preserve history over time.

### Permissions
To manage access to the Grafana resources, you must map permissions to the role. A custom role without permissions has no effect, but could be created in any case.

### UID of the role
Each custom role has a UID defined which is a unique identifier associated with the role allowing you to change or delete the role. You can either generate UID yourself, or let the API generate one for you.
