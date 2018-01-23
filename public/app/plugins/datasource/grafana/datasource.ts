import _ from 'lodash';

class GrafanaDatasource {

  /** @ngInject */
  constructor(private backendSrv, private $q, private templateSrv) {}

  query(options) {
    return this.backendSrv
      .get('/api/tsdb/testdata/random-walk', {
        from: options.range.from.valueOf(),
        to: options.range.to.valueOf(),
        intervalMs: options.intervalMs,
        maxDataPoints: options.maxDataPoints,
      })
      .then(res => {
        var data = [];

        if (res.results) {
          _.forEach(res.results, queryRes => {
            for (let series of queryRes.series) {
              data.push({
                target: series.name,
                datapoints: series.points,
              });
            }
          });
        }

        return {data: data};
      });
  }

  metricFindQuery(options) {
    return this.$q.when({data: []});
  }


  annotationQuery(options) {
    const params: any = {
      from: options.range.from.valueOf(),
      to: options.range.to.valueOf(),
      limit: options.annotation.limit,
      tags: options.annotation.tags,
    };

    var multiValQueries = {};

    if (options.annotation.type === 'dashboard') {
      // if no dashboard id yet return
      if (!options.dashboard.id) {
        return this.$q.when([]);
      }
      // filter by dashboard id
      params.dashboardId = options.dashboard.id;
      // remove tags filter if any
      delete params.tags;
    } else {
      // require at least one tag
      if (!_.isArray(options.annotation.tags) || options.annotation.tags.length === 0) {
        return this.$q.when([]);
      }
      const tags = [];
      for (let t of params.tags) {
        let replaced = this.templateSrv.replace(t),
          didReplace = (replaced !== t),
          mvbIdx = replaced.indexOf('{'),
          mvbEndIdx = replaced.lastIndexOf('}');

        // check for multi-val template replacements
        if (didReplace && mvbIdx !== -1 && mvbEndIdx !== -1) {

          // do we have actual multiple values
          let replArea = replaced.substring(mvbIdx+1, mvbEndIdx),
            commaIdx = replArea.indexOf(',');

          if (commaIdx !== -1) {
            let tagVals = replArea.split(',');

            for (let tt of tagVals) {
              let fullVal = replaced.substring(0, mvbIdx).concat(tt, replaced.substring(mvbEndIdx+2));
              if (!multiValQueries.hasOwnProperty(replaced)) {
                multiValQueries[replaced] = [];
              }
              multiValQueries[replaced].push(fullVal);
            }
          } else {
            // just one value from a multi
            let fullVal = replaced.substring(0, mvbIdx).concat(replArea, replaced.substring(mvbEndIdx+2));
            tags.push(fullVal);
          }

        } else {
          // no replacement or no multi-val values, this tag is all set
          tags.push(replaced);
        }
      }
      params.tags = tags;
    }

    if (Object.keys(multiValQueries).length > 0) {
      let proms = [],
        qvals = Object.keys(multiValQueries).map(key=>multiValQueries[key]),
        combos = qvals.reduce(function(a, b) {
          return a.map(function(x) {
            return b.map(function(y) {
              return x.concat(y);
            });
          }).reduce(function(a, b) { return a.concat(b); }, []);
        }, [[]]);

      for (let combo of combos) {
        let newTags = [...params.tags, ...combo];
        const nparams: any = {
          from: options.range.from.valueOf(),
          to: options.range.to.valueOf(),
          limit: options.annotation.limit,
          tags: newTags
        };

        proms.push(this.backendSrv.get('/api/annotations', nparams));
      }

      // build single promise and combine all results into one array
      return this.$q.all(proms).then(results => {
        return [].concat.apply([], results);
      });

    } else {
      return this.backendSrv.get('/api/annotations', params);
    }
  }
}

export {GrafanaDatasource};
