# Query service

This query service aims to replace the existing /api/ds/query, while preserving the same parsing and expression handling as `/api/ds/query`



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
    participant db as Storage<br/>(CloudConfig)
    participant ds as Datasource<br/>Plugin
    participant expr as Expression<br/>Engine

    User->>api: POST Query
    loop Each query
        api->>api: Parse query
        api->>db: Get ds config<br>and secrets
        db->>api: 
    end
    alt Expressions exist
        api->>expr: Calculate expressions graph
        loop Each node (eg, refID)
          alt Is query
              expr->>ds: QueryData
          else Is expression
            expr->>expr: Process
          end
        end
    else No expressions
      alt Single datasource
          api->>ds: QueryData
      else Multiple datasources
        loop Each datasource (concurrently)
          api->>ds: QueryData
        end
        api->>api: Wait for results
      end
    end
    api->>User: return results
```