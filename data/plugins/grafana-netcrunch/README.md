# NetCrunch App for Grafana

## NetCrunch App activation
![Image Title](https://raw.githubusercontent.com/adremsoft/grafana-netcrunch-plugin/master/doc/movies/activate-netcrunch-plugin.gif)

## Create NetCrunch datasource
![Image Title](https://raw.githubusercontent.com/adremsoft/grafana-netcrunch-plugin/master/doc/movies/create-datasource.gif)

![Image Title](https://raw.githubusercontent.com/adremsoft/grafana-netcrunch-plugin/master/doc/images/datasource-list.jpg)

## Templates

### Select template
![Image Title](https://raw.githubusercontent.com/adremsoft/grafana-netcrunch-plugin/master/doc/movies/select-template.gif)

### Windows workstation
![Image Title](https://raw.githubusercontent.com/adremsoft/grafana-netcrunch-plugin/master/doc/images/windows-workstation-template.jpg)

### Windows server
![Image Title](https://raw.githubusercontent.com/adremsoft/grafana-netcrunch-plugin/master/doc/images/windows-server-template.jpg)

### Linux
![Image Title](https://raw.githubusercontent.com/adremsoft/grafana-netcrunch-plugin/master/doc/images/linux-template.jpg)

### ESX
![Image Title](https://raw.githubusercontent.com/adremsoft/grafana-netcrunch-plugin/master/doc/images/esx-template.jpg)

## Create dashboard
![Image Title](https://raw.githubusercontent.com/adremsoft/grafana-netcrunch-plugin/master/doc/movies/create-dashboard.gif)

## Create template dashboard

![Image Title](https://raw.githubusercontent.com/adremsoft/grafana-netcrunch-plugin/master/doc/images/create-template-1.png)

### Add datasource variable

![Image Title](https://raw.githubusercontent.com/adremsoft/grafana-netcrunch-plugin/master/doc/images/create-template-2.png)

### Add node variable

![Image Title](https://raw.githubusercontent.com/adremsoft/grafana-netcrunch-plugin/master/doc/images/create-template-3.png)

Query option for variable is used for filtering nodes by type and should has one of values:

* nodes.windows
* nodes.windows.server
* nodes.windows.workstation
* nodes.linux
* nodes.bsd
* nodes.macos
* nodes.solaris
* nodes.esx
* nodes.xenserver
* nodes.unix
* nodes.novell
* nodes.ibm

### View of variables

![Image Title](https://raw.githubusercontent.com/adremsoft/grafana-netcrunch-plugin/master/doc/images/create-template-4.png)

### Define a metric of template

![Image Title](https://raw.githubusercontent.com/adremsoft/grafana-netcrunch-plugin/master/doc/images/create-template-5.png)

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
```
grunt develop
grunt watch
```
