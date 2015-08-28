"use strict";
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
var request = require('request');
<<<<<<< 4080e71f0162df6f7aadfa1ac979c53ba86b9bba
<<<<<<< d2990b60ec74138d9a51007b47efbcb10200a2cf
var _ = require('lodash');
=======
// var _ = require('lodash');
>>>>>>> [OWL-30] Add Echarts map to Grafana
=======
var _ = require('lodash');
>>>>>>> [OWL-52] Add servers distribution map among provinces
var fs = require('fs');
var path = require('path');

/**
<<<<<<< d2990b60ec74138d9a51007b47efbcb10200a2cf
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
=======
 * @function name:	function getMapData()
 * @description:	This function gets hosts locations for map chart.
 * @related issues:	OWL-052, OWL-030
 * @param:			void
 * @return:			array hosts
 * @author:			Don Hsieh
 * @since:			08/15/2015
 * @last modified: 	08/27/2015
 * @called by:		app.post('/')
 *					 in open-falcon/server.js
 */
function getMapData()
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
						// console.log(province);
						if (key2.length && key2 !== 'lat' && key2 !== 'lng' && key2 !== 'count') {
							obj = {};
							obj.name = key2;
							obj.value = city.count;
							citiesInProvince.push(obj);
						}
					});
				}
				console.log(key);
				console.log(province);
			});
		});
		hosts.chartType = 'map';
		hosts.provinces = provinces;
		hosts.citiesInProvince = citiesInProvince;
		console.log('hosts =', hosts);
		return [hosts];
	} catch(e) {
<<<<<<< 4080e71f0162df6f7aadfa1ac979c53ba86b9bba
		// console.log('Exception e =', e);
>>>>>>> [OWL-30] Add Echarts map to Grafana
=======
		console.log('Exception e =', e);
>>>>>>> [OWL-52] Add servers distribution map among provinces
		return hosts;
	}
}

/**
<<<<<<< d2990b60ec74138d9a51007b47efbcb10200a2cf
 * @function name:	function function queryMetric(req, res, targets)
 * @description:	This function gets hosts locations for map chart.
 * @related issues:	OWL-168, OWL-123, OWL-030
 * @param:			object req
 * @param:			object res
 * @param:			array targets
 * @return:			void
 * @author:			Don Hsieh
 * @since:			08/15/2015
 * @last modified: 	11/11/2015
 * @called by:		app.post('/')
=======
 * @function name:	function getMapData()
 * @description:	This function gets hosts locations for map chart.
 * @related issues:	OWL-030
 * @param:			void
 * @return:			array results
 * @author:			Don Hsieh
 * @since:			08/15/2015
 * @last modified: 	08/15/2015
<<<<<<< 4080e71f0162df6f7aadfa1ac979c53ba86b9bba
 * @call	ed by:		app.post('/')
>>>>>>> [OWL-30] Add Echarts map to Grafana
=======
 * @called by:		app.post('/')
>>>>>>> [OWL-52] Add servers distribution map among provinces
 *					 in open-falcon/server.js
 */
function queryMetric(req, res, targets)
{
	var metrics = [];
	var target = '';
<<<<<<< d2990b60ec74138d9a51007b47efbcb10200a2cf
=======
	/*
	 *	MODIFIED FOR TEMPLATING
	 */
>>>>>>> [OWL-30] Add Echarts map to Grafana
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
<<<<<<< d2990b60ec74138d9a51007b47efbcb10200a2cf
			from = now + parseInt(from) * unit;
		} else if (from.indexOf('h') > 0) {
			unit = 3600;
			from = now + parseInt(from) * unit;
		} else if (from.indexOf('d') > 0) {
			unit = 86400;
			from = now + parseInt(from) * unit;
		} else {
			from = parseInt(from);
		}

		var urlQuery = req.query['urlQuery'];
		urlQuery += '/graph/history';
		var options = {
			uri: urlQuery,
=======
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

		var queryUrl = req.query['target'].split('//')[1].split(':')[0] + ':9966/graph/history';
		queryUrl = req.query['target'].split('//')[0] + '//' + queryUrl;
		// console.log('queryUrl =', queryUrl);

		var options = {
			uri: queryUrl,
>>>>>>> [OWL-30] Add Echarts map to Grafana
			method: 'POST',
			json: {
				"endpoint_counters": metrics,
				"cf": "AVERAGE",
<<<<<<< d2990b60ec74138d9a51007b47efbcb10200a2cf
				"start": from,
=======
				"start": now + from,
>>>>>>> [OWL-30] Add Echarts map to Grafana
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
<<<<<<< a2d270ce4eb24ecb3d78b6b26f90d191e215427c
 * @description:	This route returns list of hosts (endpoints) if query[0] == '*';
 *					 returns list of metrics (counters) otherwise.
 * @related issues:	OWL-168
 * @related issues:	OWL-123, OWL-063, OWL-032, OWL-029, OWL-017
=======
 * @description:	This route returns list of hosts (endpoints)
 *					 if query[0] == '*'; returns list of metrics (counters)
 *					 otherwise.
 * @related issues:	OWL-029, OWL-017
>>>>>>> OWL-29 autocomplete for hostname request
 * @param:			object req
 * @param:			object res
 * @return:			array results
 * @author:			Don Hsieh, WH Lin
 * @since:			07/25/2015
<<<<<<< a2d270ce4eb24ecb3d78b6b26f90d191e215427c
 * @last modified: 	11/11/2015
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
<<<<<<< a2d270ce4eb24ecb3d78b6b26f90d191e215427c
	var query = arrQuery['query'].replace('undefined', '').replace('.select metric', '');
	var limit = 'limit';

	var host = query.split('.')[0];
	var gotHostname = host.length > 4;
	if (!gotHostname) {	// Query hosts, i.e., endpoints.
		query = host.replace('*', '');
		if (query === '') {
			query = '%';
			limit = 'limit=500';
			results.push({text: 'chart', expandable: true});
		}

		url = urlDashboard + '/api/endpoints?q=' + query + '&tags&' + limit + '&_r=' + Math.random();
=======
	var query = arrQuery['query'];
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
<<<<<<< 124f395b6c30f3d71bbe95537f01a0b612dbc93d
				res.send(results);
=======
				res.send([]);
>>>>>>> [OWL-34] Set vm.variable.multi = true; to enable hostname selection in Grafana template
			}
		});
	} else {	// Query metrics (counters) of a specific host.
		query = query.replace('.select metric', '').replace('.*', '').split('.');
		if (query[query.length-1].indexOf('{') > -1) {
			query.pop();
		} else {}
<<<<<<< 124f395b6c30f3d71bbe95537f01a0b612dbc93d
		host = query.shift();
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
=======
		var host = query.shift();
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
			uri: queryUrl + '/api/counters',
			method: 'POST',
			form: {
				"endpoints": host,
				"q": metric_q,	// both '' and null are ok
				"limit": '',
				"_r": Math.random()
>>>>>>> [OWL-34] Set vm.variable.multi = true; to enable hostname selection in Grafana template
			}
			metric_q = arr.join('.');

<<<<<<< 124f395b6c30f3d71bbe95537f01a0b612dbc93d
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
=======
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
					for (var i in body.data) {
						arr = body.data[i];
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
					}
				} else {	// Query next level of metric
					for (var j in body.data) {
						arr = body.data[j];
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
					}
				}
				console.log('results =', results);
				res.send(results);
			}
		});
>>>>>>> [OWL-34] Set vm.variable.multi = true; to enable hostname selection in Grafana template
	}
});

/**
 * @function:		app.post('/', function(req, res))
 * @description:	This route returns list of datapoints [timestamp, value]
 *					 for Grafana to draw diagram.
<<<<<<< 124f395b6c30f3d71bbe95537f01a0b612dbc93d
 * @related issues:	OWL-062, OWL-063, OWL-034, OWL-017
=======
 * @related issues:	OWL-034, OWL-017
>>>>>>> [OWL-34] Set vm.variable.multi = true; to enable hostname selection in Grafana template
 * @param:			object req
 * @param:			object res
 * @return:			array results
 * @author:			Don Hsieh
 * @since:			07/25/2015
<<<<<<< 124f395b6c30f3d71bbe95537f01a0b612dbc93d
 * @last modified: 	08/28/2015
=======
 * @last modified: 	08/07/2015
>>>>>>> [OWL-34] Set vm.variable.multi = true; to enable hostname selection in Grafana template
 * @called by:		POST http://localhost:4001
 *					func ProxyDataSourceRequest(c *middleware.Context)
 *					 in pkg/api/dataproxy.go
 */
app.post('/', function (req, res) {
<<<<<<< d2990b60ec74138d9a51007b47efbcb10200a2cf
<<<<<<< 124f395b6c30f3d71bbe95537f01a0b612dbc93d
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
				res.send(results);
			} else {
				res.send([]);
=======
	var queryUrl = req.query['target'].split('//')[1].split(':')[0] + ':9966/graph/history';
	queryUrl = req.query['target'].split('//')[0] + '//' + queryUrl;
	console.log('queryUrl =', queryUrl);

=======
>>>>>>> [OWL-30] Add Echarts map to Grafana
	if ('target' in req.body) {
		var targets = req.body.target;
		if (typeof(targets) === typeof('')) {
			targets = [targets];
		}
<<<<<<< d2990b60ec74138d9a51007b47efbcb10200a2cf

		/*
		 *	MODIFIED FOR TEMPLATING
		 */
		console.log('targets =', targets);
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
>>>>>>> [OWL-34] Set vm.variable.multi = true; to enable hostname selection in Grafana template
			}
		} else {
			if (typeof(targets) === typeof('')) {
				targets = [targets];
			}
			queryMetric(req, res, targets);
		}
<<<<<<< 124f395b6c30f3d71bbe95537f01a0b612dbc93d
=======

		if (metrics.length) {
			var options = {
				uri: queryUrl,
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
=======
		if (targets.indexOf('map') > -1) {
			var results = getMapData();
			// console.log('results =', results);
			res.send(results);
>>>>>>> [OWL-30] Add Echarts map to Grafana
		} else {
			queryMetric(req, res, targets);
		}
>>>>>>> [OWL-34] Set vm.variable.multi = true; to enable hostname selection in Grafana template
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