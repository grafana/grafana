/*

  ## bbuzz

  A special panel for my Berlin Buzzwords talk

  ### Parameters
  * None
  ### Group Events
  #### Sends
  * get_time :: On panel initialization get time range to query
  #### Receives
  * time :: An object containing the time range to use and the index(es) to query

*/
angular.module('kibana.bbuzz', [])
.controller('bbuzz', function($scope, eventBus, $http, bbuzz) {

  // Set and populate defaults
  var _d = {
    group   : "default",
  }
  _.defaults($scope.panel,_d)

  $scope.init = function () {
    $scope.nodes = {};
    $scope.settings = {};
    $scope.indices = [];
    $scope.bbuzz = bbuzz
    $scope.colors = bbuzz.colors(20)
    eventBus.register($scope,'time', function(event,time){
      set_time(time)
    });
    // Now that we're all setup, request the time from our group
    eventBus.broadcast($scope.$id,$scope.panel.group,'get_time')
  }

  $scope.set_replicas = function(replicas) {
    $http.put(config.elasticsearch+'/_settings', {
      "index" : {"number_of_replicas" : replicas}
    }).success(function (data) {
      $scope.get_data();
    });
  }

  $scope.status = function(ip) {
    var something = $http({
      url: "http://"+ip+':4567/status',
      method: "GET"
    }).error(function(data, status, headers, config) {
      $scope.error = status;
    });

    return something.then(function(p) {
      return p.data
    });
  }

  $scope.node_mode = function(ip,mode) {
    $http({method: 'GET', url: "http://"+ip+':4567/'+mode}).
    success(function(data, status, headers, config) {
      control.log(data)
      $scope.get_data();
    }).
    error(function(data, status, headers, config) {
      console.log(data, status)
      $scope.get_data();
    });
  }

  $scope.get_data = function() {

    // Get cluster health 
    if (!_.isNumber($scope.settings.replicas)) {
      $http({method: 'GET', url: config.elasticsearch+'/_settings'}).
      success(function(data, status, headers, config) {
        $scope.settings.replicas = parseInt(_.pairs(data)[0][1].settings['index.number_of_replicas'])
      }).
      error(function(data, status, headers, config) {
        console.log('Could not contact elasticsearch at: '+config.elasticsearch)
      });
    }

    // Get cluster health 
    $http({method: 'GET', url: config.elasticsearch+'/_cluster/health'}).
    success(function(data, status, headers, config) {
      $scope.cluster = data 
    }).
    error(function(data, status, headers, config) {
      console.log('Could not contact elasticsearch at: '+config.elasticsearch)
    });

    // And nodes list
    $http({method: 'GET', url: config.elasticsearch+'/_cluster/state'}).
    success(function(data, status, headers, config) {
      var i = []
      _.each(data.routing_nodes.nodes, function(v,node) {
        i[node] = _.groupBy(v,'index')
      })
      $scope.nodes.routing = i;
      $scope.nodes.info = data.nodes
      $scope.nodes.live = _.pluck(data.nodes,'transport_address'),
      $scope.nodes.dead = _.difference(bbuzz.get_nodes(),_.pluck(data.nodes,'transport_address'))
      //$scope.nodes.dead = ['inet[/10.126.115.79:9300]'];
      $scope.indices = _.union($scope.indices,_.keys(i))

      _.each($scope.nodes.dead,function(node) {
        $http({
          url: "http://"+bbuzz.ip_address(node)+':4567/status',
          method: "GET"
        }).success(function(data, status, headers, config) {
          if(_.isUndefined($scope.nodes.status))
            $scope.nodes.status = {};
          $scope.nodes.status[node] = 'data';
        })
      })

    }).
    error(function(data, status, headers, config) {
      console.log('Could not contact elasticsearch at: '+config.elasticsearch)
    });
  }

  // returns list of shards sorted by index
  $scope.sorted_shards = function(shards) {
    return _.sortBy(shards, function(shard) {
      return shard.index
    })
  }

  $scope.primary = function(shards,primary) {
    return _.filter(shards, function(shard) {
      return shard.primary === primary ? true: false;
    })
  }

  $scope.shard_class = function(state) {
    switch(state)
    {
    case 'INITIALIZING':
      return ['animated','flash','infinite']
    case 'RELOCATING':
      return ['faded']
    default:
      return ''
    }
  }

  $scope.cluster_class = function(state) {
    switch(state)
    {
    case 'green':
      return 'btn-success'
    case 'yellow':
      return 'btn-warning'
    case 'red': 
      return 'btn-danger'
    default:
      return 'btn-inverse'
    }
  }

  $scope.cluster_color = function(state) {
    switch(state)
    {
    case 'green':
      var style = {color: '#FFF', bg: '#5BB75B', light: '#62C462', dark: '#51A351'}
      break;
    case 'yellow':
      var style = {color: '#FFF', bg: '#FAA732', light: '#FBB450', dark: '#F89406'}
      break;
    case 'red': 
      var style = {color: '#FFF', bg: "#DA4F49", light: '#EE5F5B', dark: '#BD362F'}
      break;
    default:
      var style = {color: '#000', bg: "#F5F5F5", light: '#FFFFFF', dark: '#E6E6E6'}
      break;
    }
    return { 
      'color': style.color,
      'margin-bottom': '0px',
      'font-weight': 200,
      'background-color': style.bg,
      'background-image': 'linear-gradient(to bottom, '+style.light+', '+style.dark+')',
      'background-repeat': 'repeat-x',
      'border-color': 'rgba(0, 0, 0, 0.1) rgba(0, 0, 0, 0.1) rgba(0, 0, 0, 0.25)',
      'border-style': 'solid',
      'border-width': '1px',
      'box-shadow': '0 1px 0 rgba(255, 255, 255, 0.2) inset, 0 1px 2px rgba(0, 0, 0, 0.05)',
      'padding': '10px'
    };
  }

  function set_time(time) {
    $scope.time = time;
    $scope.get_data();
  }

}).directive('started', function(eventBus) {
  return {
    restrict: 'C',
    link: function(scope, elem, attrs, ctrl) {
      console.log('shard')

      // Receive render events
      scope.$on('render',function(){
        render_panel();
      });
  
      // Re-render if the window is resized
      angular.element(window).bind('resize', function(){
        render_panel();
      });

      // Function for rendering panel
      function render_panel() {

        var scripts = $LAB.script("common/lib/panels/jquery.flot.js")

        // Populate element.
        scripts.wait(function(){
          try {

          } catch(e) {
            elem.text(e)
          }
        })
      }

    }
  };
}).service('bbuzz', function($timeout) {
  var nodes = []; 
  var indices = [];

  this.index_id = function(id) {
    if (!_.contains(indices,id))
      indices.push(id)
    return _.indexOf(indices,id)
  }

  this.index_color = function(id) {
    var i = this.index_id(id)
    var colors = this.colors(indices.length)
    return colors[i];
  }

  this.ip_address = function(transport_address) {
    return transport_address.split(/[\/:]/)[1]
  }

  this.node_id = function(id) {
    if (!_.contains(nodes,id))
      nodes.push(id)
    return _.indexOf(nodes,id)
  }

  this.get_nodes = function() {
    return nodes;
  }

  this.picture = function(id) {
    return 'panels/bbuzz/img/'+this.node_id(id)+'.jpg'
  }

  this.colors = function(count) {
    // produce colors as needed
    var seed = ['#86B22D','#BF6730','#1D7373','#BFB930','#BF3030','#77207D']
    var colors = [], variation = 0;
    i = 0;
    while (colors.length < count) {
      var c;
      if (seed.length == i) // check degenerate case
        c = new Color(100, 100, 100);
      else
        c = parseColor(seed[i]);

      // vary color if needed
      var sign = variation % 2 == 1 ? -1 : 1;
      var factor = 1 + sign * Math.ceil(variation / 2) * 0.2;
      c.scale(factor, factor, factor);

      // FIXME: if we're getting to close to something else,
      // we should probably skip this one
      colors.push(c.toString());
     
      ++i;
      if (i >= seed.length) {
        i = 0;
        ++variation;
      }
    }
    return colors;
  }

  function parseColor(str) {
    var result;
    // Look for #a0b1c2
    if (result = /#([a-fA-F0-9]{2})([a-fA-F0-9]{2})([a-fA-F0-9]{2})/.exec(str))
      return new Color(parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16));
    // Look for #fff
    if (result = /#([a-fA-F0-9])([a-fA-F0-9])([a-fA-F0-9])/.exec(str))
      return new Color(parseInt(result[1]+result[1], 16), parseInt(result[2]+result[2], 16), parseInt(result[3]+result[3], 16));
  }

  // color helpers, inspiration from the jquery color animation
  // plugin by John Resig
  function Color (r, g, b, a) {
       
    var rgba = ['r','g','b','a'];
    var x = 4; //rgba.length
       
    while (-1<--x) {
      this[rgba[x]] = arguments[x] || ((x==3) ? 1.0 : 0);
    }
       
    this.toString = function() {
      if (this.a >= 1.0) {
        return "rgb("+[this.r,this.g,this.b].join(",")+")";
      } else {
        return "rgba("+[this.r,this.g,this.b,this.a].join(",")+")";
      }
    };

    this.scale = function(rf, gf, bf, af) {
      x = 4; //rgba.length
      while (-1<--x) {
        if (arguments[x] != null)
          this[rgba[x]] *= arguments[x];
        }
        return this.normalize();
      };

      this.adjust = function(rd, gd, bd, ad) {
        x = 4; //rgba.length
        while (-1<--x) {
          if (arguments[x] != null)
            this[rgba[x]] += arguments[x];
          }
          return this.normalize();
        };

      this.clone = function() {
        return new Color(this.r, this.b, this.g, this.a);
      };

      var limit = function(val,minVal,maxVal) {
        return Math.max(Math.min(val, maxVal), minVal);
      };

      this.normalize = function() {
        this.r = clamp(0, parseInt(this.r), 255);
        this.g = clamp(0, parseInt(this.g), 255);
        this.b = clamp(0, parseInt(this.b), 255);
        this.a = clamp(0, this.a, 1);
        return this;
      };

      this.normalize();
    }

    function clamp(min, value, max) {
      if (value < min)
        return min;
      else if (value > max)
        return max;
      else
        return value;
    }


})
