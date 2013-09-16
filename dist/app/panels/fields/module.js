/*! kibana - v3.0.0m3pre - 2013-09-16
 * Copyright (c) 2013 Rashid Khan; Licensed Apache License */

define("panels/fields/module",["angular","app","underscore"],function(a,b,c){var d=a.module("kibana.panels.fields",[]);b.useModule(d),d.controller("fields",["$scope",function(a){a.panelMeta={status:"Deprecated",description:"You should not use this table, it does not work anymore. The table panel nowintegrates a field selector. This module will soon be removed."};var b={style:{},arrange:"vertical",micropanel_position:"right"};c.defaults(a.panel,b),a.init=function(){}}])});