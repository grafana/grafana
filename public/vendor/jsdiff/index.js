define([
  './jsdiff'
], function(jsdiff) {
  'use strict';
  
  var Diff = {
    /**
     * Builds and returns a visual diff view.  The single parameter, `params', should contain
     * the following values:
     *
     * - baseTextLines: the array of strings that was used as the base text input to SequenceMatcher
     * - newTextLines: the array of strings that was used as the new text input to SequenceMatcher
     * - opcodes: the array of arrays returned by SequenceMatcher.get_opcodes()
     * - baseTextName: the title to be displayed above the base text listing in the diff view; defaults
     *	   to "Base Text"
     * - newTextName: the title to be displayed above the new text listing in the diff view; defaults
     *	   to "New Text"
     * - contextSize: the number of lines of context to show around differences; by default, all lines
     *	   are shown
     * - viewType: if 0, a side-by-side diff view is generated (default); if 1, an inline diff view is
     *	   generated
     */
    buildView: function (params) {
      var baseTextLines = difflib.stringAsLines(params.baseTextLines);
      var newTextLines = difflib.stringAsLines(params.newTextLines);
      var opcodes = new difflib.SequenceMatcher(baseTextLines, newTextLines).get_opcodes();  // params.opcodes;
      var baseTextName = params.baseTextName ? params.baseTextName : "Base Text";
      var newTextName = params.newTextName ? params.newTextName : "New Text";
      var contextSize = params.contextSize;
      var inline = (params.viewType == 0 || params.viewType == 1) ? params.viewType : 0;
  
      if (baseTextLines == null)
        throw "Cannot build diff view; baseTextLines is not defined.";
      if (newTextLines == null)
        throw "Cannot build diff view; newTextLines is not defined.";
      if (!opcodes)
        throw "Canno build diff view; opcodes is not defined.";
      
      function celt (name, clazz) {
        var e = document.createElement(name);
        e.className = clazz;
        return e;
      }
      
      function telt (name, text) {
        var e = document.createElement(name);
        e.appendChild(document.createTextNode(text));
        return e;
      }
      
      function ctelt (name, clazz, text) {
        var e = document.createElement(name);
        var span = document.createElement("span");
        e.className = clazz;
        span.appendChild(document.createTextNode(text));
        e.appendChild(span);
        return e;
      }

      var tdata = document.createElement("colgroup");
      var node;
      for (var i = 0; i < 4; i++) {
        node = document.createElement("col");
        tdata.appendChild(node);
        // (i === 0 || i === 2) && node.setAttribute("style", "width: 40px") 
      }
      tdata = [tdata];
    
      var thead = document.createElement("thead");
      node = document.createElement("tr");
      thead.appendChild(node);
      if (inline) {
        node.appendChild(document.createElement("th"));
        node.appendChild(document.createElement("th"));
        node.appendChild(ctelt("th", "texttitle", baseTextName + " vs. " + newTextName));
      } else {
        node.appendChild(document.createElement("th"));
        node.appendChild(ctelt("th", "texttitle", baseTextName));
        node.appendChild(document.createElement("th"));
        node.appendChild(ctelt("th", "texttitle", newTextName));
      }
      tdata.push(thead);
      
      var rows = [];
      var node2;
      
      /**
       * Adds two cells to the given row; if the given row corresponds to a real
       * line number (based on the line index tidx and the endpoint of the 
       * range in question tend), then the cells will contain the line number
       * and the line of text from textLines at position tidx (with the class of
       * the second cell set to the name of the change represented), and tidx + 1 will
       * be returned.	 Otherwise, tidx is returned, and two empty cells are added
       * to the given row.
       */
      function addCells (row, tidx, tend, textLines, change) {
        if (tidx < tend) {
          row.appendChild(ctelt("th", change, (tidx + 1).toString()));
          row.appendChild(ctelt("td", change, textLines[tidx].replace(/\t/g, "\u00a0\u00a0\u00a0\u00a0")));
          return tidx + 1;
        } else {
          row.appendChild(celt("th", "empty"));
          row.appendChild(celt("td", "empty"));
          return tidx;
        }
      }
      
      function addCellsInline (row, tidx, tidx2, textLines, change) {
        row.appendChild(telt("th", tidx == null ? "" : (tidx + 1).toString()));
        row.appendChild(telt("th", tidx2 == null ? "" : (tidx2 + 1).toString()));
        row.appendChild(ctelt("td", change, textLines[tidx != null ? tidx : tidx2].replace(/\t/g, "\u00a0\u00a0\u00a0\u00a0")));
      }
      
      var code, change;
      for (var idx = 0; idx < opcodes.length; idx++) {
        code = opcodes[idx];
        change = code[0];
        var b = code[1];
        var be = code[2];
        var n = code[3];
        var ne = code[4];
        var rowcnt = Math.max(be - b, ne - n);
        var toprows = [];
        var botrows = [];
        for (var i = 0; i < rowcnt; i++) {
          // jump ahead if we've alredy provided leading context or if this is the first range
          if (contextSize && opcodes.length > 1 && ((idx > 0 && i == contextSize) || (idx == 0 && i == 0)) && change=="equal") {
            var jump = rowcnt - ((idx == 0 ? 1 : 2) * contextSize);
            if (jump > 1) {
              toprows.push(node = document.createElement("tr"));
              
              b += jump;
              n += jump;
              i += jump - 1;
              node.appendChild(telt("th", "..."));
              if (!inline) node.appendChild(ctelt("td", "skip", ""));
              node.appendChild(telt("th", "..."));
              node.appendChild(ctelt("td", "skip", ""));
              
              // skip last lines if they're all equal
              if (idx + 1 == opcodes.length) {
                break;
              } else {
                continue;
              }
            }
          }
          
          toprows.push(node = document.createElement("tr"));
          if (inline) {
            if (change == "insert") {
              addCellsInline(node, null, n++, newTextLines, change);
            } else if (change == "replace") {
              botrows.push(node2 = document.createElement("tr"));
              if (b < be) addCellsInline(node, b++, null, baseTextLines, "delete");
              if (n < ne) addCellsInline(node2, null, n++, newTextLines, "insert");
            } else if (change == "delete") {
              addCellsInline(node, b++, null, baseTextLines, change);
            } else {
              // equal
              addCellsInline(node, b++, n++, baseTextLines, change);
            }
          } else {
            b = addCells(node, b, be, baseTextLines, change);
            n = addCells(node, n, ne, newTextLines, change);
          }
        }
  
        for (var i = 0; i < toprows.length; i++) rows.push(toprows[i]);
        for (var i = 0; i < botrows.length; i++) rows.push(botrows[i]);
      }
      
      node.setAttribute("colspan", inline ? 3 : 4);

      tdata.push(node = document.createElement("tbody"));
      for (var idx in rows) rows.hasOwnProperty(idx) && node.appendChild(rows[idx]);
      
      node = celt("table", "diff" + (inline ? " inlinediff" : ""));
      for (var idx in tdata) tdata.hasOwnProperty(idx) && node.appendChild(tdata[idx]);
      return node;
    }
  };

  return Diff;
});