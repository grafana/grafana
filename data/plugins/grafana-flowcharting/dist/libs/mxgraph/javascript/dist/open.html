<!DOCTYPE html>
<html>
<head>
    <title>Open Diagram</title>
    <link rel="stylesheet" type="text/css" href="styles/grapheditor.css" />
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
</head>
<script type="text/javascript">
	// Reads files locally
	function handleFiles(files)
	{
		for (var i = 0; i < files.length; i++)
		{
			(function(file)
			{
				// Small hack to support import
				if (window.parent.openNew)
				{
					window.parent.open(window.parent.location.href);
				}
				
				var reader = new FileReader();
				reader.onload = function(e)
				{
					window.parent.openFile.setData(e.target.result, file.name);
				};
				reader.onerror = function(e)
				{
					console.log(e);
				};
				reader.readAsText(file);
			})(files[i]);
		}
	};

	// Handles form-submit by preparing to process response
	function handleSubmit()
	{
		var form = window.openForm || document.getElementById('openForm');
		
		// Checks for support of the File API for local file access
		// except for files where the parse is on the server
		if (window.parent.Graph.fileSupport && form.upfile.files.length > 0)
		{
			handleFiles(form.upfile.files);
			
			return false;
		}
		else
		{
			if (/(\.xml)$/i.test(form.upfile.value) || /(\.txt)$/i.test(form.upfile.value) ||
				/(\.mxe)$/i.test(form.upfile.value))
			{
				// Small hack to support import
				if (window.parent.openNew)
				{
					window.parent.open(window.parent.location.href);
				}
				
				// NOTE: File is loaded via JS injection into the iframe, which in turn sets the
				// file contents in the parent window. The new window asks its opener if any file
				// contents are available or waits for the contents to become available.
				return true;
			}
			else
			{
				window.parent.mxUtils.alert(window.parent.mxResources.get('invalidOrMissingFile'));
				
				return false;
			}
		}
	};
	
	// Hides this dialog
	function hideWindow(cancel)
	{
		window.parent.openFile.cancel(cancel);
	}
	
	function fileChanged()
	{
		var form = window.openForm || document.getElementById('openForm');
		var openButton = document.getElementById('openButton');
		
		if (form.upfile.value.length > 0)
		{
			openButton.removeAttribute('disabled');
		}
		else
		{
			openButton.setAttribute('disabled', 'disabled');
		}		
	}

	function main()
	{
		if (window.parent.Editor.useLocalStorage)
		{
			document.body.innerHTML = '';
			var div = document.createElement('div');
			div.style.fontFamily = 'Arial';
			
			if (localStorage.length == 0)
			{
				window.parent.mxUtils.write(div, window.parent.mxResources.get('noFiles'));
			}
			else
			{
				var keys = [];
				
				for (var i = 0; i < localStorage.length; i++)
				{
					keys.push(localStorage.key(i));
				}
				
				// Sorts the array by filename (key)
				keys.sort(function (a, b)
				{
				    return a.toLowerCase().localeCompare(b.toLowerCase());
				});
				
				for (var i = 0; i < keys.length; i++)
				{
					var link = document.createElement('a');
					link.style.fontDecoration = 'none';
					link.style.fontSize = '14pt';
					var key = keys[i];
					window.parent.mxUtils.write(link, key);
					link.setAttribute('href', 'javascript:void(0);');
					div.appendChild(link);
					
					var img = document.createElement('span');
					img.className = 'geSprite geSprite-delete';
					img.style.position = 'relative';
					img.style.cursor = 'pointer';
					img.style.display = 'inline-block';
					div.appendChild(img);
					
					window.parent.mxUtils.br(div);
					
					window.parent.mxEvent.addListener(img, 'click', (function(k)
					{
						return function()
						{
							if (window.parent.mxUtils.confirm(window.parent.mxResources.get('delete') + ' "' + k + '"?'))
							{
								localStorage.removeItem(k);
								window.location.reload();
							}
						};
					})(key));

					window.parent.mxEvent.addListener(link, 'click', (function(k)
					{
						return function()
						{
							try
							{
								window.parent.open(window.parent.location.href);
								window.parent.openFile.setData(localStorage.getItem(k), k);
							}
							catch (e)
							{
								window.parent.mxUtils.alert(e.message);
							}
						};
					})(key));
				}
			}

			window.parent.mxUtils.br(div);
			window.parent.mxUtils.br(div);
			
			var cancelBtn = window.parent.mxUtils.button(window.parent.mxResources.get('cancel'), function()
			{
				hideWindow(true);
			});
			cancelBtn.className = 'geBtn';
			div.appendChild(cancelBtn);
			
			document.body.appendChild(div);
		}
		else
		{
			var editLink = document.getElementById('editLink');
			var openButton = document.getElementById('openButton');
			openButton.value = window.parent.mxResources.get(window.parent.openKey || 'open');
			var cancelButton = document.getElementById('cancelButton');
			cancelButton.value = window.parent.mxResources.get('cancel');
			var supportedText = document.getElementById('openSupported');
			supportedText.innerHTML = window.parent.mxResources.get('openSupported');
			var form = window.openForm || document.getElementById('openForm');

			form.setAttribute('action', window.parent.OPEN_URL);
		}
	};
</script>
<body onload="main();">
<form method="POST" enctype="multipart/form-data" action="" name="openForm"
	id="openForm" onsubmit="return handleSubmit();" accept-charset="UTF-8">
<table style="width:100%;">
<tr>
<td style="height:40px;vertical-align:top;" colspan="2">
<input type="file" name="upfile" onchange="fileChanged()">
</td>
</tr>
<tr>
<td colspan="2" height="120px" id="openSupported" style="font-family:arial;color:grey;font-size:9pt;vertical-align:top;text-align:left;">
</td>
</tr>
<tr>
<td>
</td>
<td style="vertical-align:middle;text-align:right;white-space:nowrap;">
<input type="button" id="cancelButton" class="geBtn" value="Cancel" onclick="hideWindow(true);">
<input type="submit" id="openButton" class="geBtn gePrimaryBtn" value="Open" disabled="disabled">
</td>
</tr>
</table>
</form>
</body>
</html>
