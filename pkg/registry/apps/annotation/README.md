# Annotations App

New annotations API built on the app platform.

## Background

**Old system**: `pkg/services/annotations`

**New system**: `pkg/registry/apps/annotation/` (this directory)

## Goals

1. Build annotations API on app platform with Kubernetes-style resource model
2. **Scope**: User-created annotations only (no alerting annotations)
3. **Storage**: Pluggable storage system that:
   - Scales in cloud environments (hundreds of millions of annotations)
   - Supports existing Grafana backends for on-prem deployments
   - Optimized for real-world access patterns (99% of queries target recent time windows)

## Key Problems Being Solved

- **Performance**: Current SQL implementation causes slow writes/reads and problematic cleanup
- **Scale**: Cloud clusters have hundreds of millions of annotations
- **Conceptual overload**: Multiple annotation types share one data model
- **No storage abstraction**: Tight coupling between API and SQL

## Architecture

### Layer Diagram

The annotation app bridges three incompatible interfaces through a series of adapters:

```
┌─────────────────────────────────────────────────────────────┐
│                    K8s API Request                          │
│     GET /apis/annotation.grafana.app/v0alpha1/...          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 3: k8sRESTAdapter (register.go)                      │
│  • Implements: rest.Getter, rest.Lister, rest.Creater, etc. │
│  • Handles: K8s API conventions (fieldSelectors, etc.)      │
│  • Input/Output: runtime.Object                             │
└────────────────────────┬────────────────────────────────────┘
                         │ calls Store interface
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 2: sqlAdapter (sql_adapter.go)                       │
│  • Implements: Store interface (Get, List, Create, etc.)    │
│  • Converts: v0alpha1.Annotation ↔ annotations.ItemDTO     │
│  • Purpose: Bridge NEW interface → OLD repository           │
└────────────────────────┬────────────────────────────────────┘
                         │ calls Repository methods
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 1: annotations.Repository (pkg/services/annotations) │
│  • OLD Grafana annotation service                           │
│  • Methods: Find(), Save(), Update(), Delete()              │
│  • Data model: annotations.ItemDTO                          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
                   ┌──────────┐
                   │ SQL DB   │
                   └──────────┘
```

**Why so many layers?**
- **Layer 1** (Repository): Exists, can't change (legacy system)
- **Layer 2** (sqlAdapter): BRIDGE for migration - enables dual-writer pattern
- **Layer 3** (k8sRESTAdapter): REQUIRED by app platform architecture

Once migration is complete, Layer 2 can be removed and a new Store implementation can directly replace it.

### API Design (Kubernetes-style)
- Versioned, declarative resource model (`annotationv0alpha1`)
- RESTful endpoints: `/apis/annotation.grafana.app/v0alpha1/namespaces/<ns>/annotations`
- **Immutability constraints**: Only text and tags are mutable; time ranges and references are immutable

### Storage Interface
Three decoupled interfaces:
- `Store`: CRUD operations (Get, List, Create, Update, Delete)
- `TagStore`: Tag autocomplete with in-memory reference counting
- `LifecycleManager`: TTL-based retention and cleanup

### Storage Options

**1. SQL Adapter** (`sql_adapter.go`)
- Wraps legacy `pkg/services/annotations.Repository`
- Required for dual-writer pattern during migration

**2. Sorted Key-Value Store**
- DIY approach with explicit indexing via structured keys
- Optimized for time-range scans
- PR: https://github.com/grafana/grafana/pull/114780

**3. SQL with Time-Based Partitioning** (Recommended for Cloud)
- Weekly partitions (e.g., `annotations_2025w04`)
- PostgreSQL recommended with BRIN indices (4x speedup)
- Cleanup via partition drop (no expensive DELETE queries)
- SQLite: no partitioning support
- **Status**: Implementation in progress - see [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)

## Important Constraints

- **Time immutability**: Once created, annotation time ranges cannot be modified
- **Query patterns**: >99% of queries target recent time windows
- **Tag storage**: In-memory reference counting with periodic persistence
- **Cleanup**: TTL-based retention preferred over count-based

## Migration

Dual-writer approach using SQL adapter enables gradual migration from old to new system.
