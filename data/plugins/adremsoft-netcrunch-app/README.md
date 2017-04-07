# NetCrunch App for Grafana

## NetCrunch App activation
![Image Title](https://raw.githubusercontent.com/adremsoft/grafana-netcrunch-plugin/grafCrunch/doc/movies/activate-netcrunch-plugin.gif)

## Create NetCrunch datasource
![Image Title](https://raw.githubusercontent.com/adremsoft/grafana-netcrunch-plugin/grafCrunch/doc/movies/create-datasource.gif)

![Image Title](https://raw.githubusercontent.com/adremsoft/grafana-netcrunch-plugin/grafCrunch/doc/images/datasource-list.jpg)

## Templates

### Select template
![Image Title](https://raw.githubusercontent.com/adremsoft/grafana-netcrunch-plugin/grafCrunch/doc/movies/select-template.gif)

### Windows workstation
![Image Title](https://raw.githubusercontent.com/adremsoft/grafana-netcrunch-plugin/grafCrunch/doc/images/windows-workstation-template.jpg)

### Windows server
![Image Title](https://raw.githubusercontent.com/adremsoft/grafana-netcrunch-plugin/grafCrunch/doc/images/windows-server-template.jpg)

### Linux
![Image Title](https://raw.githubusercontent.com/adremsoft/grafana-netcrunch-plugin/grafCrunch/doc/images/linux-template.jpg)

### ESX
![Image Title](https://raw.githubusercontent.com/adremsoft/grafana-netcrunch-plugin/grafCrunch/doc/images/esx-template.jpg)

## Create dashboard
![Image Title](https://raw.githubusercontent.com/adremsoft/grafana-netcrunch-plugin/grafCrunch/doc/movies/create-dashboard.gif)

## Create template dashboard

![Image Title](https://raw.githubusercontent.com/adremsoft/grafana-netcrunch-plugin/grafCrunch/doc/images/create-template-1.png)

### Add datasource variable

![Image Title](https://raw.githubusercontent.com/adremsoft/grafana-netcrunch-plugin/grafCrunch/doc/images/create-template-2.png)

### Add node variable

![Image Title](https://raw.githubusercontent.com/adremsoft/grafana-netcrunch-plugin/grafCrunch/doc/images/create-template-3.png)

#### Query

The query is used to filter the nodes available in the template  and should have following syntax:

`<query> ::= 'nodes'['.'<map> | '.'<monitoringPack>]['.'<nodeType>]`

##### `nodes` 

This part of the query is obligatory and gives all nodes from the network atlas.
The simplest possible query that returns all atlas nodes is `nodes`. 

##### `<map>`

This selector allows to filter the nodes that belongs to particular atlas map.
To select the map it's necessary to specify a atlas group, folders and
view using the following syntax:

`networkAtlas("group name").folder("folder name").view("view name")`

###### Example

The query to filter out the nodes belonging to the view shown in the image below is as follows:

`nodes.networkAtlas("Custom Views").folder("My custom folder").folder("My sub folder").view("My view")`

Characters `(` `)` `"` occurring in names must be quoted by `\`. To get nodes from view `My view (old)`
query should be:

`nodes.networkAtlas("Custom Views").folder("My custom folder").folder("My sub folder").view("My view \(old\)")`

![Image Title](https://raw.githubusercontent.com/adremsoft/grafana-netcrunch-plugin/grafCrunch/doc/images/template-query-maps-view.jpg)

##### `<monitoringPack>`

This selector allows to filter the nodes to which specific monitoring pack has been added.
To select the monitoring pack it's necessary to specify a monitoring pack's folder, sub-folder and name using the following syntax:

`nodes.monitoringPacks.folder("Folder name").folder("Sub-folder name").name("Monitoring pack name")`

###### Example

The query to filter out the nodes to which monitoring pack shown in the image below has been added is as follows:

`nodes.monitoringPacks.folder("Hardware").folder("Network Devices").name("Cisco \(SNMP\)")`

![Image Title](https://raw.githubusercontent.com/adremsoft/grafana-netcrunch-plugin/grafCrunch/doc/images/template-query-monitoring-pack-view.jpg)

##### `<nodeType>`

This selector is used to filter nodes by type and may be combined with other selectors. 
The types of nodes that can be filter are as follows:

* windows
* windows.server
* windows.workstation
* linux
* bsd
* macos
* solaris
* esx
* xenserver
* unix
* novell
* ibm

###### Example

The query to filter out all linux nodes from a specific IP network is as follows:

`nodes.networkAtlas("IP Networks").folder("Local").view("192.168.0.0/22").linux`

### View of variables

![Image Title](https://raw.githubusercontent.com/adremsoft/grafana-netcrunch-plugin/grafCrunch/doc/images/create-template-4.png)

### Define a metric of template

![Image Title](https://raw.githubusercontent.com/adremsoft/grafana-netcrunch-plugin/grafCrunch/doc/images/create-template-5.png)

## Changelog

### v1.0.0
- NetCrunch datasource
- Templates: esx, linux, windows-server, windows-workstation

## Development

### Building
```
npm install
```

#### Production
```
grunt build
```

#### Development

Update value of `developmentDest` in Gruntfile.js.

```
grunt develop
grunt watch
```
