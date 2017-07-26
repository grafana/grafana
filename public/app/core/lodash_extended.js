define([
  'lodash-src'
],
function () {
  'use strict';

  var _ = window._;

  /*
    Mixins :)
  */
  _.mixin({
    move: function (array, fromIndex, toIndex) {
      array.splice(toIndex, 0, array.splice(fromIndex, 1)[0]);
      return array;
    },
    // If variable is value, then return alt. If variable is anything else, return value;
    toggle: function (variable, value, alt) {
      return variable === value ? alt : value;
    },
    toggleInOut: function(array,value) {
      if(_.contains(array,value)) {
        array = _.without(array,value);
      } else {
        array.push(value);
      }
      return array;
    }
  });

  /*
   A metric is in the format of <orgId>.<sysId>.<metric short name>.
   Note that a metric short name may also have '.' in it.
  */
  _.getMetricName = function (metricName) {
    var elem = metricName.split(".");
    if(elem.length < 3){
      return metricName;
    }
    return metricName.substring(metricName.indexOf(elem[2]));
  };

  _.excludeMetricSuffix = function (metricName) {
    return !(/(anomaly|prediction.max|prediction.min|.LB.percent|.seasonal|.trend|.noise|.prediction|.health|.system.health|.LB|.periodMinutes)$/.test(metricName));
  };

  _.allServies = function () {
    return {
      "hadoop.datanode": "Hadoop DataNode",
      "hadoop.namenode": "Hadoop NameNode",
      "hbase.master": "Hbase Master",
      "hbase.regionserver": "Hbase RegionServer",
      "kafka": "Kafka",
      "mysql": "Mysql",
      "spark": "Spark",
      "storm": "Storm",
      "yarn": "Yarn",
      "zookeeper": "Zookeeper",
      "tomcat": "Tomcat",
      "opentsdb": "OpenTSDB",
      "mongo3": "MongoDB 3.x",
      "nginx": "Nginx",
      "postgresql": "Postgresql",
      "redis": "Redis",
      "rabbitmq": "RabbitMQ"
    };
  };

  _.getLeveal = function (score) {
    if (!_.isNumber(score) && _.isNaN(score) && _.isEmpty(score)) {
      return "无";
    }
    if (score > 75) {
      return "优";
    } else if (score > 50) {
      return "良";
    } else if (score > 25) {
      return "中";
    } else {
      return "差";
    }
  };
  return _;
});
