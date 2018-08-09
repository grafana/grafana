This folder contains useful scripts and configuration for...

* Configuring dev datasources in Grafana
* Configuring dev & test scenarios dashboards.

```bash
./setup.sh
```

After restarting grafana server there should now be a number of datasources named `gdev-<type>` provisioned as well as a dashboard folder named `gdev dashboards`. This folder contains dashboard & panel features tests dashboards. 

# Dev dashboards

Please update these dashboards or make new ones as new panels & dashboards features are developed or new bugs are found. The dashboards are located in the `devenv/dev-dashboards` folder. 


