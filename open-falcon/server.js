"use strict";
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
var request = require('request');

/**
 * @function:		app.get('/', function(req, res))
 * @description:	This route returns list of hosts (endpoints)
 *					 if query[0] == '*'; returns list of metrics (counters)
 *					 otherwise.
 * @related issues:	OWL-032, OWL-029, OWL-017
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

	if (query.indexOf('*.') === 0) {	// Query hosts, i.e., endpoints.
		query = query.replace('*.', '');
		url = queryUrl + '/api/endpoints?q=' + query + '&tags&limit&_r=' + Math.random();
		request(url, function (error, response, body) {
			if (!error && response.statusCode === 200) {
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
			} else {
				res.send([]);
			}
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
				res.send(results);
			}
		});
	}
});

/**
 * @function:		app.post('/', function(req, res))
 * @description:	This route returns list of datapoints [timestamp, value]
 *					 for Grafana to draw diagram.
 * @related issues:	OWL-034, OWL-017
 * @param:			object req
 * @param:			object res
 * @return:			array results
 * @author:			Don Hsieh
 * @since:			07/25/2015
 * @last modified: 	08/07/2015
 * @called by:		POST http://localhost:4001
 *					func ProxyDataSourceRequest(c *middleware.Context)
 *					 in pkg/api/dataproxy.go
 */
app.post('/', function (req, res) {
	var queryUrl = req.query['target'].split('//')[1].split(':')[0] + ':9966/graph/history';
	queryUrl = req.query['target'].split('//')[0] + '//' + queryUrl;
	console.log('queryUrl =', queryUrl);

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
		var target = '';
		var targets = req.body.target;
		if (typeof(targets) === typeof('')) {
			targets = [targets];
		}

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
