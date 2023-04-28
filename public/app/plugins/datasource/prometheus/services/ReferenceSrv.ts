import { clone, each, keyBy } from 'lodash';

export interface QueryWithReference {
  expr: string;
  refId: string;
  refCount?: number;
}

interface ReferenceSrvProps {
  initialQueries: QueryWithReference[];
}

type RefId = string;

export class ReferenceSrv {
  interpolate() {}

  queries: Map<RefId, QueryWithReference> = new Map();

  getQuery(query: QueryWithReference): QueryWithReference | undefined {
    return this.queries.get(query.refId);
  }

  getQueries(): QueryWithReference[] {
    return Array.from(this.queries).map((mappedQuery) => mappedQuery[1]);
  }

  setQuery(query: QueryWithReference): void {
    this.queries.set(query.refId, query);
  }

  constructor(props: ReferenceSrvProps) {
    if (props.initialQueries) {
      props.initialQueries.forEach((query) => {
        this.queries.set(query.refId, query);
      });
    }
  }

  /**
   *
   * @param staleTarget
   */
  interpolatePrometheusReferences(staleTarget: QueryWithReference): QueryWithReference {
    const targets = this.getQueries();
    const target = clone(this.getQuery(staleTarget));

    if (target) {
      // render nested query
      const targetsByRefId = keyBy(targets, 'refId');

      // no references to self
      delete targetsByRefId[target.refId];

      const nestedSeriesRefRegex = /@([A-Z])/g;

      // Use ref count to track circular references
      each(targetsByRefId, (t, id) => {
        const regex = RegExp(`\@(${id})`, 'g');
        const refMatches = target.expr.match(regex);
        t.refCount = refMatches?.length ?? 0;
      });

      // Shamelessly stolen from Graphite
      // Keep interpolating until there are no query references
      // The reason for the loop is that the referenced query might contain another reference to another query
      while (target.expr.match(nestedSeriesRefRegex)) {
        const updated = target.expr.replace(nestedSeriesRefRegex, (match: string, g1: string) => {
          const t = targetsByRefId[g1];
          if (!t) {
            return match;
          }

          // no circular references
          if (t.refCount === 0) {
            delete targetsByRefId[g1];
          }
          t.refCount ? t.refCount-- : (t.refCount = 0);

          return t.expr;
        });

        if (updated === target.expr) {
          break;
        }

        target.expr = updated;
      }

      if (target.expr.match(nestedSeriesRefRegex)) {
        throw new Error('Unable to interpolate query reference, check for circular references');
      }

      return target;
    } else {
      throw new Error('Attempting to interpolate a target that has not been added to state!');
    }
  }
}

let singletonInstance: ReferenceSrv;

export const getReferenceSrv = (props?: ReferenceSrvProps) => {
  if (!singletonInstance && props) {
    singletonInstance = new ReferenceSrv(props);
  }

  return singletonInstance;
};
