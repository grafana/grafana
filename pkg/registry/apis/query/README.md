# Query service

This query service aims to replace the existing /api/ds/query.  

The key differences are:
1. This service has a stronger type system (not simplejson)
2. Same workflow regardless if expressions exist
3. Datasource settings+access is managed in each datasource, not at the beginning



### Current /api/ds/query workflow

```mermaid
sequenceDiagram
    autonumber
    actor User as User or Process
    participant api as /api/ds/query
    participant db as Storage<br/>(SQL)
    participant ds as Datasource<br/>Plugin
    participant expr as Expression<br/>Engine

    User->>api: POST Query
    loop Each query
        api->>api: Parse query
        api->>db: Get ds config<br>and secrets
        db->>api: 
    end
    alt No expressions
      alt Single datasource
          api->>ds: QueryData
      else Multiple datasources
        loop Each datasource (concurrently)
          api->>ds: QueryData
        end
        api->>api: Wait for results
      end
    else Expressions exist
        api->>expr: Calculate expressions graph
        loop Each node (eg, refID)
          alt Is query
              expr->>ds: QueryData
          else Is expression
            expr->>expr: Process
          end
        end
    end
    api->>User: return results
```



### /apis/query.grafana.app (in single tenant grafana)

```mermaid
sequenceDiagram
    autonumber
    actor User as User or Process
    participant api as /apis/query.grafana.app
    participant ds as Datasource<br/>Handler/Plugin
    participant db as Storage<br/>(SQL)
    participant expr as Expression<br/>Engine

    User->>api: POST Query
    api->>api: Parse queries
    api->>api: Calculate dependencies
    loop Each datasource (concurrently)
        api->>ds: QueryData
        ds->>ds: Verify user access
        ds->>db: Get settings <br> and secrets
    end
    loop Each expression
        api->>expr: Execute
    end
    api->>api: Verify ResultExpectations
    api->>User: return results
```

