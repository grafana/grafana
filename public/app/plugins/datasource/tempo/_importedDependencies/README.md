This directory contains dependencies that we duplicated from Grafana core while working on the decoupling of Tempo from such core.
The long-term goal is to move these files away from here by replacing them with packages.
As such, they are only temporary and meant to be used internally to this package, please avoid using them for example as dependencies (imports) in other data source plugins.
