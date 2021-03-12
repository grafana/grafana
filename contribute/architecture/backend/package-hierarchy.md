# Package hierarchy

The Go package hierarchy in Grafana should be organized logically (Ben Johnson's
[article](https://medium.com/@benbjohnson/standard-package-layout-7cdbc8391fc1) served as inspiration), according to the 
following principles:

* Domain types and interfaces should be in "root" packages (not necessarily at the very top, of the hierarchy, but
  logical roots)
* Sub-packages should depend on roots - sub-packages here typically contain implementations, for example of services
