function get_object_fields(obj) {
  var field_array = [];
  obj = flatten_json(obj._source)
  for (field in obj) {
    field_array.push(field);
  }
  return field_array.sort();
}

function get_all_fields(json) {
  var field_array = [];
  var obj_fields;
  for (hit in json.hits.hits) {
    obj_fields = get_object_fields(json.hits.hits[hit]);
    for (index in obj_fields) {
      if (_.indexOf(field_array,obj_fields[index]) < 0) {
        field_array.push(obj_fields[index]);
      }
    }
  }
  return field_array.sort();
}

function has_field(obj,field) {
  var obj_fields = get_object_fields(obj);
  if (_.inArray(obj_fields,field) < 0) {
    return false;
  } else {
    return true;
  }
}

// Retuns a sorted array with duplicates removed
function array_unique(arr) {
  var sorted_arr = arr.sort();
  var results = [];
  for (var i = 0; i <= arr.length - 1; i++) {
    if (sorted_arr[i + 1] != sorted_arr[i]) {
        results.push(sorted_arr[i]);
    }
  }
  return results
}

function get_objids_with_field(json,field) {
  var objid_array = [];
  for (hit in json.hits.hits) {
    if(has_field(json.hits.hits[hit],field)) {
      objid_array.push(hit);
    }
  }
  return objid_array;
}

function get_objids_with_field_value(json,field,value) {
  var objid_array = [];
  for (hit in json.hits.hits) {
    var hit_obj = json.hits.hits[hit];
    if(has_field(hit_obj,field)) {
      var field_val = get_field_value(hit_obj,field,'raw')
      if(_.isArray(field_val)) {
        if(_.inArray(field_val,field) >= 0) {
          objid_array.push(hit);
        }
      } else {
        if(field_val == value) {
          objid_array.push(hit);
        }
      }
    } else {
      if ( value == '')
        objid_array.push(hit);
    }
  }
  return objid_array;
}

function get_related_fields(json,field) {
  var field_array = []
  for (hit in json.hits.hits) {
    var obj_fields = get_object_fields(json.hits.hits[hit])
    if (_.inArray(obj_fields,field) >= 0) {
      field_array.push.apply(field_array,obj_fields);
    }
  }
  var counts = count_values_in_array(field_array);
  return counts;
}

function recurse_field_dots(object,field) {
  var value = null;
  if (typeof object[field] != 'undefined')
    value = object[field];
  else if (nested = field.match(/(.*?)\.(.*)/))
    if(typeof object[nested[1]] != 'undefined')
      value = (typeof object[nested[1]][nested[2]] != 'undefined') ?
        object[nested[1]][nested[2]] : recurse_field_dots(
          object[nested[1]],nested[2]);

  return value;
}

// Probably useless now
function get_field_value(object,field,opt) {
  var value = recurse_field_dots(object['_source'],field);

  if(value === null)
    return ''
  if(_.isArray(value))
    if (opt == 'raw') {
      return value;
    }
    else {
        var complex = false;
        _.each(value, function(el, index) {
            if (typeof(el) == 'object') {
                complex = true;
            }
        })
        if (complex) {
            return JSON.stringify(value, null, 4);
        }
        return value.toString();
    }
  if(typeof value === 'object' && value != null)
    // Leaving this out for now
    //return opt == 'raw' ? value : JSON.stringify(value,null,4)
    return JSON.stringify(value,null,4)

  return (value != null) ? value.toString() : '';
}

// Returns a big flat array of all values for a field
function get_all_values_for_field(docs,field) {
  var field_array = [];
  _.each(docs, function(doc,k) {
    var value = doc[field]
    if(typeof value === 'object' && value != null) {
      field_array.push.apply(field_array,value);
    } else {
      field_array.push(value);
    }
  })    
  return field_array;
}

function top_field_values(docs,field,count) {
  var counts = _.countBy(get_all_values_for_field(docs,field),function(field){return field;});
  return _.pairs(counts).sort(function(a, b) {return a[1] - b[1]}).reverse().slice(0,count)
}

 /**
   * Calculate a graph interval
   *
   * from::           Date object containing the start time
   * to::             Date object containing the finish time
   * size::           Calculate to approximately this many bars
   * user_interval::  User specified histogram interval
   *
   */
function calculate_interval(from,to,size,user_interval) {
  if(_.isObject(from))
    from = from.getTime();
  if(_.isObject(to))
    to = to.getTime();
  return user_interval == 0 ? round_interval((to - from)/size) : user_interval;
}

function get_bar_count(from,to,interval) {
  return (to - from)/interval;
}

function round_interval (interval) {
  switch (true) {
    case (interval <= 500):       return 100;
    case (interval <= 5000):      return 1000;
    case (interval <= 7500):      return 5000;
    case (interval <= 15000):     return 10000;
    case (interval <= 45000):     return 30000;
    case (interval <= 180000):    return 60000;
    case (interval <= 450000):    return 300000;
    case (interval <= 1200000):   return 600000;
    case (interval <= 2700000):   return 1800000;
    case (interval <= 7200000):   return 3600000;
    case (interval <= 21600000):  return 10800000;
    default:                      return 43200000;
  }
}

function secondsToHms(seconds){
    var numyears = Math.floor(seconds / 31536000);
    if(numyears){
        return numyears + 'y';
    }
    var numdays = Math.floor((seconds % 31536000) / 86400);
    if(numdays){
        return numdays + 'd';
    }
    var numhours = Math.floor(((seconds % 31536000) % 86400) / 3600);
    if(numhours){
        return numhours + 'h';
    }
    var numminutes = Math.floor((((seconds % 31536000) % 86400) % 3600) / 60);
    if(numminutes){
        return numminutes + 'm';
    }
    var numseconds = (((seconds % 31536000) % 86400) % 3600) % 60;
    if(numseconds){
        return numseconds + 's';
    }
    return 'less then a second'; //'just now' //or other string you like;
}

function to_percent(number,outof) {
  return Math.round((number/outof)*10000)/100 + "%";
}

function addslashes(str) {
  str = str.replace(/\\/g, '\\\\');
  str = str.replace(/\'/g, '\\\'');
  str = str.replace(/\"/g, '\\"');
  str = str.replace(/\0/g, '\\0');
  return str;
}

// Create an ISO8601 compliant timestamp for ES
//function ISODateString(unixtime) {
  //var d = new Date(parseInt(unixtime));
function ISODateString(d) {
  if(is_int(d)) {
    d = new Date(parseInt(d));
  }

  function pad(n) {
    return n < 10 ? '0' + n : n
  }
  return d.getFullYear() + '-' +
    pad(d.getMonth() + 1) + '-' +
    pad(d.getDate()) + 'T' +
    pad(d.getHours()) + ':' +
    pad(d.getMinutes()) + ':' +
    pad(d.getSeconds());
}

function pickDateString(d) {
  return dateFormat(d,'yyyy-mm-dd HH:MM:ss')
}

function prettyDateString(d) {
  d = new Date(parseInt(d));
  d = utc_date_obj(d);
  return dateFormat(d,window.time_format);
}

function utc_date_obj(d) {
  return new Date(
    d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(),  
    d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(),
    d.getUTCMilliseconds());
}

function local_date_obj(d) {
  return new Date(Date.UTC(
    d.getFullYear(), d.getMonth(), d.getDate(),  
    d.getHours(), d.getMinutes(), d.getSeconds()));
}

function is_int(value) {
  if ((parseFloat(value) == parseInt(value)) && !isNaN(value)) {
    return true;
  } else {
    return false;
  }
}

function interval_to_seconds(string) {
  var matches = string.match(/(\d+)([Mwdhms])/);
  switch (matches[2]) {
    case 'M': return matches[1]*2592000;;
    case 'w': return matches[1]*604800;;
    case 'd': return matches[1]*86400;;
    case 'h': return matches[1]*3600;;
    case 'm': return matches[1]*60;;
    case 's': return matches[1];
  } 
}

function time_ago(string) {
  return new Date(new Date().getTime() - (interval_to_seconds(string)*1000))
}

function flatten_json(object,root,array) {
  if (typeof array === 'undefined')
    var array = {};
  if (typeof root === 'undefined')
    var root = '';
  for(var index in object) {
    var obj = object[index]
    var rootname = root.length == 0 ? index : root + '.' + index;
    if(typeof obj == 'object' ) {
      if(_.isArray(obj))
        array[rootname] = typeof obj === 'undefined' ? null : obj.join(',');
      else
        flatten_json(obj,rootname,array)
    } else {
      array[rootname] = typeof obj === 'undefined' ? null : obj;
    }
  }
  return sortObj(array);
}

function xmlEnt(value) {
  if(_.isString(value)) {
  var stg1 = value.replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\r\n/g, '<br/>')
    .replace(/\r/g, '<br/>')
    .replace(/\n/g, '<br/>')
    .replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;')
    .replace(/  /g, '&nbsp;&nbsp;')
    .replace(/&lt;del&gt;/g, '<del>')
    .replace(/&lt;\/del&gt;/g, '</del>');
  return stg1
  } else {
    return value
  }
}

function sortObj(arr) {
  // Setup Arrays
  var sortedKeys = new Array();
  var sortedObj = {};

  // Separate keys and sort them
  for (var i in arr) {
    sortedKeys.push(i);
  }
  sortedKeys.sort();

  // Reconstruct sorted obj based on keys
  for (var i in sortedKeys) {
    sortedObj[sortedKeys[i]] = arr[sortedKeys[i]];
  }
  return sortedObj;
}

// WTF. Has to be a better way to do this. Hi Tyler.
function int_to_tz(offset) {
  var hour = offset / 1000 / 3600
  var str = ""
  if (hour == 0) {
    str = "+0000"
  }
  if (hour < 0) {
    if (hour > -10)
      str = "-0" + (hour * -100)
    else
      str = "-" + (hour * -100)
  }
  if (hour > 0) {
    if (hour < 10)
      str = "+0" + (hour * 100)
    else
      str = "+" + (hour * 100)
  }
  str = str.substring(0,3) + ":" + str.substring(3);
  return str
}

// Sets #hash, thus refreshing results
function setHash(json) {
  window.location.hash = encodeURIComponent(Base64.encode(JSON.stringify(json)));
}

// Add commas to numbers
function addCommas(nStr) {
  nStr += '';
  var x = nStr.split('.');
  var x1 = x[0];
  var x2 = x.length > 1 ? '.' + x[1] : '';
  var rgx = /(\d+)(\d{3})/;
  while (rgx.test(x1)) {
    x1 = x1.replace(rgx, '$1' + ',' + '$2');
  }
  return x1 + x2;
}

// Split up log spaceless strings
// Str = string to split
// num = number of letters between <wbr> tags
function wbr(str, num) {
  str = htmlEntities(str);
  return str.replace(
    RegExp("(@?\\w{" + num + "}|[:;,])([\\w\"'])([\\w@]*)", "g"),
    function (all, text, char, trailer) {
      if (/@KIBANA_\w+_(START|END)@/.test(all)) {
        return text + char + trailer;
      } else {
        return text + "<del>&#8203;</del>" + char + trailer;
      }
    }
  );
}

function htmlEntities(str) {
    return String(str).replace(
      /&/g, '&amp;').replace(
      /</g, '&lt;').replace(
      />/g, '&gt;').replace(
      /"/g, '&quot;');
}


_.mixin({
    move: function (array, fromIndex, toIndex) {
      array.splice(toIndex, 0, array.splice(fromIndex, 1)[0] );
      return array;
    } 
});

_.mixin({
    remove: function (array, index) {
      array.splice(index, 1);
      return array;
    } 
});
