/**	plugin builder for requirejs optimization
 */

define(function() {

	var fs = require.nodeRequire('fs');

	function loadfile (url, callback) {
		var file = fs.readFileSync(url, 'utf8');
		//Remove BOM (Byte Mark Order) from utf8 files if it is there.
		if (file.indexOf('\uFEFF') === 0) {
			file = file.substring(1);
		}
		callback(file);
	};

	function strip (content) {
		return content.replace(/[\r\n]+/g," ").replace(/[\t]/g," ");
	}

	var buildMap = {};
	var writeonce = false;

	var loader =
	{
		load: function (name, require, load, config) {
			//console.log('css-build: load: '+name);
			load(true);
			loadfile(config.baseUrl+name,function(F){
				buildMap[name]=strip(F);
			});
		},

		write: function (pluginName, moduleName, write, config) {

			if( !writeonce)
			{
				writeonce=true;
				write(
					"define('"+pluginName+"-embed', function()\n{\n"+
					"\tfunction embed_css(content)\n"+
					"\t{\n"+
					"\t\tvar head = document.getElementsByTagName('head')[0],\n"+
					"\t\tstyle = document.createElement('style'),\n"+
					"\t\trules = document.createTextNode(content);\n"+
					"\t\tstyle.type = 'text/css';\n"+
					"\t\tif(style.styleSheet)\n"+
					"\t\t\tstyle.styleSheet.cssText = rules.nodeValue;\n"+
					"\t\telse style.appendChild(rules);\n"+
					"\t\t\thead.appendChild(style);\n"+
					"\t}\n"+
					"\treturn embed_css;\n"+
					"});\n"
				);
			}

			write(
				"define('"+pluginName+'!'+moduleName+"', ['"+pluginName+"-embed'], \n"+
				"function(embed)\n{\n"+
					"\tembed(\n\t'"+buildMap[moduleName].replace(/'/g, "\\'")+"'\n\t);\n"+
					"\treturn true;\n"+
				"});\n"
			);
		},

		writeFile: function (pluginName, moduleName, write)
		{
			//console.log('css-build: writeFile');
		},

		onLayerEnd: function (write, data)
		{
			//console.log('css-build: onLayerEnd');
		}
	};

	return loader;
});
