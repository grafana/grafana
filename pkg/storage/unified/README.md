This includes four packages

## resource 

this is a go module that can be imported into external projects

This includes the protobuf based client+server and all the logic required to convert requests into write events.

Protobuf TODO?
* can/should we use upstream k8s proto for query object?
* starting a project today... should we use proto3?  


## apistore

The apiserver storage.Interface that links the storage to kubernetes

Mostly a copy of te


## entitybridge

Implementes a resource store using the existing entity service.  This will let us evolve the 
kubernetes interface.Store using existing system structures while we explore better options.


## sqlnext

VERY early stub exploring alternative sql structure... really just a stub right now

