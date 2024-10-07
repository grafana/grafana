<!--[if IE]><meta http-equiv="X-UA-Compatible" content="IE=5,IE=9" ><![endif]-->
<!DOCTYPE html>
<html>
<head>
    <title>Grapheditor viewer</title>
	<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
	<script type="text/javascript">
		var STENCIL_PATH = 'stencils';
		var IMAGE_PATH = 'images';
		var STYLE_PATH = 'styles';
	
		var urlParams = (function(url)
		{
			var result = new Object();
			var idx = url.lastIndexOf('?');
	
			if (idx > 0)
			{
				var params = url.substring(idx + 1).split('&');
				
				for (var i = 0; i < params.length; i++)
				{
					idx = params[i].indexOf('=');
					
					if (idx > 0)
					{
						result[params[i].substring(0, idx)] = params[i].substring(idx + 1);
					}
				}
			}
			
			return result;
		})(window.location.href);

		// Sets the base path, the UI language via URL param and configures the
		// supported languages to avoid 404s. The loading of all core language
		// resources is disabled as all required resources are in grapheditor.
		// properties. Note that in this example the loading of two resource
		// files (the special bundle and the default bundle) is disabled to
		// save a GET request. This requires that all resources be present in
		// each properties file since only one file is loaded.
		var mxLoadResources = false;
		var mxBasePath = '../../../src';
	</script>
	<script type="text/javascript" src="sanitizer/sanitizer.min.js"></script>
	<script type="text/javascript" src="../../../src/js/mxClient.js"></script>
	<script type="text/javascript" src="js/Graph.js"></script>
	<script type="text/javascript" src="js/Shapes.js"></script>
</head>
<body class="geEditor">
	Input:
	<br />
	<textarea rows="24" cols="100" id="textarea" placeholder="mxGraphModel"></textarea>
	<br />
	<button onclick="show(document.getElementById('textarea').value);return false;">Show</button>
	<div id="graph"></div>
	<script type="text/javascript">
		var graph = new Graph(document.getElementById('graph'));
		graph.resizeContainer = true;
		graph.setEnabled(false);

		function show(data)
		{
			var xmlDoc = mxUtils.parseXml(data);
			var codec = new mxCodec(xmlDoc);
			codec.decode(xmlDoc.documentElement, graph.getModel());
		};
	</script>
</body>
</html>
