grafana-pro
===========

This is very much a Work in Progess. The architecture and organisation has changed many times and I am not very happy
with the current structure and architecture. I started with a lot of unit tests and drove the design though that in 
the begining, but then having changed the code and structure (and web framework libs, and database) I sort of 
abandoned them. When the architecture is getting more stable I will write & require more unit & integration tests. 

# Architecture
I have researched a lot of go projects, found very few with a nice modular & loosly coupled archictecture. Go projects 
organize code very differently, some treat packages as global singletons (which reads nicely and is nice to work with 
but seems like a bad practice). I do miss generics for doing strongly typed but loosley coupled command/query style
internal buss messaging. 

The biggest challange for architecture is making Grafana Pro very modular in a way that all/most components can 
run inproc or in seperate process (usefull when running Grafana Pro in a large scale SaaS setup). Been investigating 
using ZeroMQ or NanoMsg to handle module communication (Both ZeroMQ and NanoMsg can handle inproc & tcp which a number of 
different topologies). Running Grafana Pro in a SaaS setup might warrant that the alerting stuff runs out of proc on 
other servers feeding of a queue for example, but for simple on prem stuff it would be cool if that could be run in the 
same process. I am also thinking that some stuff might need swapping out/in depending on the setup (plugin model or just
interfaces with different implementations). 

# Building
* Just added a simple make file (the main binary package is in pkg/cmd/grafana-pro)
* Need to change to godep or some go lang dependency management system

# Data access
Data access is very strange right now, instead of an interface I tried using public methods in the models package.
These method pointers are assigned in when the sqlstore is initialized in pkg/store/sqlstore. This is probably a 
bad idea. I am thinking about either moving to simple interfaces. But I do not want a giant interface for all 
data acess. Would much prefe a simple generic command/query interface but golang lacks generics which makes this 
painful. But a generic command/query interface could still be good as it would make it easier to have some commands or
queries handled buy out of proc components (or inproc if we used someting like ZeroMQ for communication). Or it 
could be overengineering thinking like this. 

# Grafana frontend
The grafana frontend is added as git submodule in order to easily sync with upstream grafana. 
There should be a symbolic link from ./grafana/src to ./public . Need to add this to the Makefile. 

# TODO
* Add symbolik link between ./grafana/src ./public
* Hash & Salt password
* Unit tests for data access 
* I switched recently from rethinkdb to sql (using a simple mini ORM lib called xorm, might need to switch to a more 
popular ORM lib). 

