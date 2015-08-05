var express = require('express');
var app = express();
var url = require('url');
var http = require('http');
var bodyParser = require('body-parser')
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
var request = require('request');

/**
 * @function:		app.get('/', function(req, res))
 * @description:	This route returns list of hosts (endpoints)
 *					 if query[0] == '*'; returns list of metrics (counters) 
 *					 otherwise.
 * @related issues:	OWL-029, OWL-017
 * @param:			object req
 * @param:			object res
 * @return:			array results
 * @author:			Don Hsieh, WH Lin
 * @since:			07/25/2015
 * @last modified: 	08/05/2015
 * @called by:		GET http://localhost:4001
 *					func ProxyDataSourceRequest(c *middleware.Context)
 *					 in pkg/api/dataproxy.go
 */
app.get('/', function(req, res) {
	var url = '';
	var queryUrl = req.query['target'];
	var arrQuery = req.query;
	var query = arrQuery['query'];
	if (query[0] === '*') {	// Query hosts, i.e., endpoints.
		query = query.replace('*.', '');
		url = queryUrl + '/api/endpoints?q=' + query + '&tags&limit&_r=' + Math.random();
		request(url, function (error, response, body) {
			if (!error && response.statusCode == 200) {
				body = JSON.parse(body);
				var obj = {};
				var results = [];
				for (var i in body.data) {
					obj = {};
					obj.text = body.data[i];
					obj.expandable = true;	// hosts are expandable
											// (accompanied by their metrics)
					results.push(obj);
				}
				res.send(results);
			} else res.send([]);
		});
	} else {	// Query metrics (counters) of a specific host.
		query = query.replace('.select metric', '').replace('.*', '').split('.');
		if (query[query.length-1].indexOf('{') > -1) {
			query.pop();
		} else {}
		var host = query.shift();
		var depth = query.length;
		host = '["' + host + '"]';
		var arr = [];
		var str = '';
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
			}
		};

		request(options, function (error, response, body) {
			if (!error && response.statusCode == 200) {
				body = JSON.parse(body);
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
							} else obj.expandable = false;
							results.push(obj);
						}
					}
				} else {	// Query next level of metric
					for (var i in body.data) {
						arr = body.data[i];
						metric = arr[0];
						if (metric.indexOf(metric_q + '.') === 0) {
							metricRoot = metric.split('.')[depth];
							if (metrics.indexOf(metricRoot) < 0) {
								metrics.push(metricRoot)
								obj = {};
								obj.text = metricRoot;
								if (metricRoot === metric.split('.').pop()) {
									obj.expandable = false;
								} else obj.expandable = true;
								results.push(obj);
							}
						}
					}
				}	
				res.send(results);
			}
		});
	}
});


/**
 * @function:		app.post('/', function(req, res))
 * @description:	This route returns list of datapoints [timestamp, value]
 *					 for Grafana to draw diagram.
 * @related issues:	OWL-017
 * @param:			object req
 * @param:			object res
 * @return:			array results
 * @author:			Don Hsieh
 * @since:			07/25/2015
 * @last modified: 	07/30/2015
 * @called by:		POST http://localhost:4001
 *					func ProxyDataSourceRequest(c *middleware.Context)
 *					 in pkg/api/dataproxy.go
 */
app.post('/', function (req, res) {
	var queryUrl = req.query['target'].split('//')[1].split(':')[0] + ':9966/graph/history';
	queryUrl = req.query['target'].split('//')[0] + '//' + queryUrl;

	if ('target' in req.body) {
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
		var metrics = [];
		var pair = {};
		var endpoint = '';
		var counter = '';
		var target = '';
		var targets = req.body.target;
		if (typeof(targets) === typeof('')) {
			targets = [targets];
		}

		for (var i in targets) {
			target = targets[i];
			if (target.indexOf('.select') < 0) {
				var query = target.split('.');
				if (query[query.length-1].indexOf('{') > -1) {
					query.pop();
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
			// console.log('options =', options);
			request(options, function (error, response, body) {
				if (!error && response.statusCode == 200) {
					var results = [];
					for (var i in body) {
						if (body[i].Values) {	// if body[i] has Values
							results.push(body[i]);
						}
					}
					res.send(results);
				}
			});
		} else res.send([]);
	} else res.send([]);
});

// START THE SERVER
var server = app.listen(4001, function () {
	var host = server.address().address;
	var port = server.address().port;
	console.log('Grafana event handler listening at http://%s:%s', host, port);
});
