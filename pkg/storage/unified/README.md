This includes three packages

== resource

this is a go module that can be imported into external projects

This includes the protobuf based client+server and all the logic required to convert requests into write events.

Protobuf TODO?
- can/should we use upstream k8s proto for query object?
- starting a project today... should we use proto3?  


== apistore

The apiserver storage.Interface that links the storage to kubernetes

== sqlstash

SQL based implementation of the unified storage server




