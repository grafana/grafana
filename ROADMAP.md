# Roadmap (2017-04-23)

This roadmap is a tentative plan for the core development team. Things change constantly as PRs come in and priorities change. 
But it will give you an idea of our current vision and plan. 

### Short term (1-4 months)

 - New Heatmap Panel (Implemented and available in master)
 - Support for MySQL & Postgres as data sources (Work started and a alpha version for MySQL is available in master)
 - User Groups & Dashboard folders with ACLs (work started, not yet completed, https://github.com/grafana/grafana/issues/1611#issuecomment-287742633)
 - Improve new user UX
 - Improve docs
 - Support for alerting for Elasticsearch (can be tested in [branch](https://github.com/grafana/grafana/tree/alerting-elasticsearch) but needs more work)
  - Graph annotations (create from grafana, region annotations, better annotation viz)
  - Improve alerting (clustering, silence rules)
  
### Long term 

- Improved dashboard panel layout engine (to make it easier and enable more flexible layouts) 
- Backend plugins to support more Auth options, Alerting data sources & notifications
- Universial time series transformations for any data source (meta queries)
- Reporting
- Web socket & live data streams
- Migrate to Angular2 


### Outside contributions
We know this is being worked on right now by contributors (and we hope to merge it when it's ready). 

- Dashboard revisions (be able to revert dashboard changes)
- Clustering for alert engine (load distribution)  
