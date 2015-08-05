"use strict";
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
var request = require('request');
var _ = require('lodash');
var fs = require('fs');
var path = require('path');

/**
 * @function name:	function getMapData(chartType)
 * @description:	This function gets hosts locations for map chart.
 * @related issues:	OWL-062, OWL-052, OWL-030
 * @param:			string chartType
 * @return:			array [hosts]
 * @author:			Don Hsieh
 * @since:			08/15/2015
 * @last modified: 	08/28/2015
 * @called by:		app.post('/')
 *					 in open-falcon/server.js
 */
function getMapData(chartType)
{
	var dirData = path.join(__dirname, 'data');
	// var filePath = path.join(dirData, 'agent.json');
	var filePath = path.join(dirData, 'province.json');
	var hosts = {};
	try {
		var data = fs.readFileSync(filePath, "utf8");
		var provinces = JSON.parse(data);
		filePath = path.join(dirData, 'latlng.json');
		data = fs.readFileSync(filePath, "utf8");
		var countries = JSON.parse(data);
		var citiesInProvince = [];
		var obj = {};
		var provincesName = ['浙江', '山东', '福建', '河南', '江苏', '广东', '山西'
			, '湖北', '湖南', '吉林', '辽宁', '四川', '江西', '广西', '河北', '陕西'
			, '黑龙江', '云南', '安徽', '新疆', '甘肃', '内蒙古', '宁夏', '海南'];
		_.forEach(countries, function(country) {
			_.forEach(country, function(province, key) {
				if (provincesName.indexOf(key) > -1) {
				// if (key === '内蒙古') {
					_.forEach(province, function(city, key2) {
						if (key2.length && key2 !== 'lat' && key2 !== 'lng' && key2 !== 'count') {
							obj = {};
							obj.name = key2;
							obj.value = city.count;
							citiesInProvince.push(obj);
						}
					});
				}
			});
		});
		hosts.chartType = chartType;
		hosts.provinces = provinces;
		hosts.citiesInProvince = citiesInProvince;
		return [hosts];
	} catch (e) {
		console.log('Exception e =', e);
		return hosts;
	}
}

/**
 * @function name:	function function queryMetric(req, res, targets)
 * @description:	This function gets hosts locations for map chart.
 * @related issues:	OWL-123, OWL-030
 * @param:			object req
 * @param:			object res
 * @param:			array targets
 * @return:			void
 * @author:			Don Hsieh
 * @since:			08/15/2015
 * @last modified: 	10/20/2015
 * @called by:		app.post('/')
 *					 in open-falcon/server.js
 */
function queryMetric(req, res, targets)
{
	var metrics = [];
	var target = '';
	var i = 0;
	while (i < targets.length) {	// targets.length changes dynamically
		target = targets[i];
		i = i + 1;
		if (target.indexOf('.select') < 0) {
			var query = target.split('.');
			if (query[0].indexOf('{') > -1) {		// check if hostname is requested by templating
													// Could change to looping through query to see if there is any segment using templating.
				var template_split = query[0].replace('{', '').replace('}', '').split(',');		// split the elements we get from templating
				query.shift();		// remove the templating segment
				var toAppend = query.join('.');		// the rest of the query used to append later
				for(var idx in template_split){		// formatting a new target
					var tmp = [];					// formatting a new target
					tmp.push(template_split[idx]);
					tmp.push(toAppend);				// append
					var tmp_join = tmp.join('.');
					targets.push(tmp_join);			// push to targets[]
				}
				continue;	// goto next target
			} else {}
			var host = query.shift();
			var metric = query.join('.');
			if (host && metric) {
				metrics.push({
					"Endpoint": host,
					"Counter": metric
				});
			} else {}
		}
	}

	if (metrics.length) {
		var now = Math.floor(new Date() / 1000);
		var from = req.body.from;
		var unit = 0;
		if (from.indexOf('m') > 0) {
			unit = 60;
		}
		if (from.indexOf('h') > 0) {
			unit = 3600;
		}
		if (from.indexOf('d') > 0) {
			unit = 86400;
		}
		if (from.indexOf('h') > 0) {
			from = parseInt(from) * unit;
		}

		var urlQuery = req.query['urlQuery'];
		urlQuery += '/graph/history';
		var options = {
			uri: urlQuery,
			method: 'POST',
			json: {
				"endpoint_counters": metrics,
				"cf": "AVERAGE",
				"start": now + from,
				"end": now
			}
		};
		request(options, function (error, response, body) {
			if (!error && response.statusCode === 200) {
				var results = [];
				for (var i in body) {
					if (body[i].Values) {	// if body[i] has Values
						results.push(body[i]);
					}
				}
				res.send(results);
			}
		});
	} else {
		res.send([]);
	}
}

/**
 * @function:		app.get('/', function(req, res))
 * @description:	This route returns list of hosts (endpoints)
<<<<<<< 4cb82993107e37e359dcba77baf9b9bce01bd6e7
 *					 if query[0] == '*'; returns list of metrics (counters)
 *					 otherwise.
 * @related issues:	OWL-123, OWL-063, OWL-032, OWL-029, OWL-017
=======
 *					 if query[0] == '*'; returns list of metrics (counters) 
 *					 otherwise.
 * @related issues:	OWL-029, OWL-017
>>>>>>> OWL-29 autocomplete for hostname request
 * @param:			object req
 * @param:			object res
 * @return:			array results
 * @author:			Don Hsieh, WH Lin
 * @since:			07/25/2015
<<<<<<< 4cb82993107e37e359dcba77baf9b9bce01bd6e7
 * @last modified: 	10/23/2015
=======
 * @last modified: 	08/05/2015
>>>>>>> OWL-29 autocomplete for hostname request
 * @called by:		GET http://localhost:4001
 *					func ProxyDataSourceRequest(c *middleware.Context)
 *					 in pkg/api/dataproxy.go
 */
app.get('/', function(req, res) {
	var url = '';
	var obj = {};
	var results = [];
	var urlDashboard = req.query['urlDashboard'];
	var arrQuery = req.query;
	var query = arrQuery['query'];
<<<<<<< 4cb82993107e37e359dcba77baf9b9bce01bd6e7

	if (query.indexOf('*.') === 0) {	// Query hosts, i.e., endpoints.
		query = query.replace('*.', '');
		if ('chart'.indexOf(query) > -1) {
			results.push({text: 'chart', expandable: true});
		}
		url = urlDashboard + '/api/endpoints?q=' + query + '&tags&limit&_r=' + Math.random();
=======
	if (query[0] === '*') {	// Query hosts, i.e., endpoints.
		query = query.replace('*.', '');
		url = queryUrl + '/api/endpoints?q=' + query + '&tags&limit&_r=' + Math.random();
>>>>>>> OWL-29 autocomplete for hostname request
		request(url, function (error, response, body) {
			if (!error && response.statusCode === 200) {
				body = JSON.parse(body);
				_.forEach(body.data, function(hostname) {
					obj = {};
					obj.text = hostname;
					obj.expandable = true;	// hosts are expandable
											// (accompanied by their metrics)
					results.push(obj);
				});
				res.send(results);
			} else {
				res.send(results);
			}
		});
	} else {	// Query metrics (counters) of a specific host.
		query = query.replace('.select metric', '').replace('.*', '').split('.');
		if (query[query.length-1].indexOf('{') > -1) {
			query.pop();
		} else {}
		var host = query.shift();
		if (host === 'chart') {
			results.push({text: 'bar', expandable: false});
			results.push({text: 'map', expandable: false});
			results.push({text: 'pie', expandable: false});
			res.send(results);
		} else {
			var depth = query.length;
			host = '["' + host + '"]';
			var arr = [];
			// metric_q is the metric that sent to Open-Falcon for query
			var metric_q = query.join('.').replace('.*', '').replace('*', '');
			arr = metric_q.split('.');
			for (var i in arr) {
				if (arr[i].indexOf('select') > -1) {
					arr.splice(i, 1);
				} else {}
			}
			metric_q = arr.join('.');

			var options = {
				uri: urlDashboard + '/api/counters',
				method: 'POST',
				form: {
					"endpoints": host,
					"q": metric_q,	// both '' and null are ok
					"limit": '',
					"_r": Math.random()
				}
			};

			request(options, function (error, response, body) {
				if (!error && response.statusCode === 200) {
					body = JSON.parse(body);
					var metric = '';
					var metrics = [];
					var metricRoot = '';
					var obj = {};
					var results = [];
					if (!metric_q) {	// First metric query of a specific host
						var metricRoots = [];
						_.forEach(body.data, function(arr) {
							metric = arr[0];
							metricRoot = metric.split('.')[0];
							if (metricRoots.indexOf(metricRoot) < 0) {
								metricRoots.push(metricRoot);
								obj = {};
								obj.text = metricRoot;
								if (metric.indexOf('.') > -1) {
									obj.expandable = true;
								} else {
									obj.expandable = false;
								}
								results.push(obj);
							}
						});
					} else {	// Query next level of metric
						_.forEach(body.data, function(arr) {
							metric = arr[0];
							metricRoot = metric.split('.')[depth];
							if (metric.indexOf(metric_q + '.') === 0 && metrics.indexOf(metricRoot) < 0) {
								metrics.push(metricRoot);
								obj = {};
								obj.text = metricRoot;
								if (metricRoot === metric.split('.').pop()) {
									obj.expandable = false;
								} else {
									obj.expandable = true;
								}
								results.push(obj);
							}
						});
					}
					res.send(results);
				}
			});
		}
	}
});

/**
 * @function:		app.post('/', function(req, res))
 * @description:	This route returns list of datapoints [timestamp, value]
 *					 for Grafana to draw diagram.
 * @related issues:	OWL-062, OWL-063, OWL-034, OWL-017
 * @param:			object req
 * @param:			object res
 * @return:			array results
 * @author:			Don Hsieh
 * @since:			07/25/2015
 * @last modified: 	08/28/2015
 * @called by:		POST http://localhost:4001
 *					func ProxyDataSourceRequest(c *middleware.Context)
 *					 in pkg/api/dataproxy.go
 */
app.post('/', function (req, res) {
	if ('target' in req.body) {
		var targets = req.body.target;
		if (targets.indexOf('chart') === 0) {
			var results = [];
			if (targets.split('.')[1] === 'bar') {
				results = getMapData('bar');
				res.send(results);
			}
			else if (targets.split('.')[1] === 'map') {
				results = getMapData('map');
				res.send(results);
			} else if (targets.split('.')[1] === 'pie') {
				results = getMapData('pie');
				// console.log('results =', results);
				res.send(results);
			} else {
				res.send([]);
			}
		} else {
			if (typeof(targets) === typeof('')) {
				targets = [targets];
			}
			queryMetric(req, res, targets);
		}
	} else {
		res.send([]);
	}
});

// START THE SERVER
var server = app.listen(4001, function () {
	var host = server.address().address;
	var port = server.address().port;
	console.log('Grafana event handler listening at http://%s:%s', host, port);
});