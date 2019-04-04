This folder contains useful scripts and configuration for...

* Configuring dev datasources in Grafana
* Configuring dev & test scenarios dashboards.
* Creating docker-compose file with DBs and fake data.


# Dev dashboards and data sources

```bash
./setup.sh
```

After restarting grafana server there should now be a number of datasources named `gdev-<type>` provisioned as well as
a dashboard folder named `gdev dashboards`. This folder contains dashboard & panel features tests dashboards. 

#### Dev dashboards

Please update these dashboards or make new ones as new panels & dashboards features are developed or new bugs are
found. The dashboards are located in the `devenv/dev-dashboards` folder. 

# docker-compose with databases

```bash
./create_docker_compose.sh influxdb prometheus2 elastic5
docker-compose up
```

This command will create a docker compose file with specified databases configured and ready to run. Each database has
a prepared image with some fake data ready to use. For available databases see `docker/blocks` directory. Mind that
for some databases there are multiple images, for example there is prometheus_mac specifically for Macs or different
version.

