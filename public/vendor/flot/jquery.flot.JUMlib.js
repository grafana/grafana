/*
 * The MIT License

Copyright (c) 2012, 2013 by Juergen Marsch

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/
(function ($) {
    "use strict";
    var pluginName = "JUMlib", pluginVersion = "0.5";
    function between(v,limit1,limit2){
        if(limit2 > limit1){ return (v >= limit1 && v <= limit2); }
        else{ return(v >=limit2 && v <= limit1); }
    }
    function getMinMax(data,dataIndex){
        var mn,mx,df,dI;
        if(dataIndex){ dI = dataIndex} else{ dI = 1;}
        mn = Number.POSITIVE_INFINITY;
        mx = Number.NEGATIVE_INFINITY;
        for(var i = 0; i < data.length; i++){
            mn = Math.min(mn, data[i][dI]);
            mx = Math.max(mx, data[i][dI]);
        }
        df = mx - mn;
        return {min: mn, max: mx, diff: df};
    }
    function showHover(event,pos,item,showAlways,createText){
        var txt;
        if (item) {
            var data = item.series.data[item.dataIndex];
            if(createText){ txt = createText(data);}
            else { 
                txt = "X:" + data[0] + "<br>Y:" + data[1];
                if(data.length > 2) { for(var i = 2; i < data.length; i++){ txt += "<br>" + data[i]; } }
            }
            showTooltip(pos.pageX, pos.pageY,txt);
        }
        else { 
            if(showAlways === true){
                txt = pos.x1 + " / " + pos.y1;
                showTooltip(pos.pageX,pos.pageY,txt);
            }
            else {$("#FLOTtooltip").remove();}
        }
    }
    function showTooltip(x, y, contents){
        $("#FLOTtooltip").remove();
        $('<div id="FLOTtooltip">' + contents + '</div>').css(
            { position: 'absolute',display: 'none',top: y + 5,left: x + 5,
            border: '1px solid #fdd',padding: '2px','background-color': '#fee',opacity: 0.80
        }).appendTo("body").fadeIn(200);
    }
    function loadScripts(scripts,maxWait,callback){
        var loadedScripts = {},defs = [];
        for(var i = 0; i < scripts.length; i++){ defs.push(loadScript(scripts[i].path,scripts[i].name)); }
        $.when.apply(null,defs).then(function(){callback(loadedScripts);});
        function loadScript(path,name){
            var dfd = $.Deferred(),t;
            t = setInterval(function(){clearInterval(t);dfd.reject();},maxWait);
            $.getScript(path).done(loaded).fail(errorFound);
            return dfd.promise();
            function loaded(){ loadedScripts[name] = true;dfd.resolve();}
            function errorFound(e,f,g){console.log(path,e); loadedScripts[name] = false;dfd.reject();}    
        }
    }
    function loadJSON(scripts,maxWait,callback){
        var loadedJSON = {},defs = [];
        for(var i = 0;i < scripts.length; i++){ defs.push(loadJSON(scripts[i].path,scripts[i].name)); }
        $.when.apply(null,defs).then(function(){ callback(loadedJSON);});
        function loadJSON(path,name){
            var dfd = $.Deferred(),t;
            t = setInterval(function(){clearInterval(t);dfd.reject();},maxWait);
            $.getJSON(path,function(data){
                loadedJSON[name] = {data:data,name:name,loaded:true};
            }).done(loaded).fail(errorFound);
            return dfd.promise();
            function loaded(){ dfd.resolve(); }
            function errorFound(e,f,g){ loadedJSON[name] = {name:name,loaded:false};dfd.reject();}
        }
    }
    
    function createQuartile(data, index, indexName){
        var q0 = [], q1 = [],q2 = [],q3 = [],q4 = [], v = [], i1, i2, i3, i4, p;
        i1 = (0.25 * data.length).toFixed(0); i2 = (0.5 * data.length).toFixed(0);
        i3 = (0.75 * data.length).toFixed(0); i4 = data.length - 1;
        for (var j = 0; j < data[0].length; j++){
            p = [];
            for (var i = 0; i < data.length; i++) { p.push(data[i][j]); }
            p.sort(function(a,b){return a - b;} );
            q1.push([j,p[i1]]); q2.push([j,p[i2]]); q3.push([j,p[i3]]); q4.push([j,p[i4]]);
            q0.push([j,p[0]]); v.push([j,data[index][j]]);
        }
        var r = [ { data: q4}, { data: q3}, { data: q2}, { data: q1}, {data: q0, color: "#ffffff" },
                {label: indexName, points: {show:true}, lines: { fill: null, steps: false}, data: v}];
        return r;
    }
    function createPercentile(data, index, indexName, percentiles){
        var percentile = [], val = [], indexes = [], p,j,i;
        if(percentiles.length){
            indexes.push([0]);
            percentile.push([]);
            for(j = 0;j < percentiles.length;j++){
                indexes.push(parseInt(data.length * percentiles[j],0));
                percentile.push([]);
            }
            indexes.push(data.length - 1);
        }
        else{
            for(j = 0;j < percentiles; j++){
                indexes.push(parseInt(data.length / percentiles * j,0));
                percentile.push([]);
            }
            indexes.push(data.length - 1);
        }
        percentile.push([]);
        for(j = 0; j < data[0].length; j++){
            p = [];
            for(i = 0; i < data.length; i++){ p.push(data[i][j]); }
            p.sort(function(a,b){return a-b;});
            for(i = 0; i < percentile.length; i++ ) { percentile[i].push([j,p[indexes[i]]]); }
            val.push([j,data[index][j]]);
        }
        var r = [];
        for(j = percentile.length - 1; j > 0 ; j--){ r.push({ data: percentile[j] });}
        r.push({data: percentile[0], color:"#ffffff"});
        r.push({label: indexName, points: {show: true}, lines: { fill: null, steps: false}, data:val});
        return r;
    }
    function createSimiliarity(data1, data2, mode){
        var r = [];
        var d1 = normalize(data1);
        var d2 = normalize(data2);
        var d;
        for (var i = 0; i < d1.length; i++){
            switch (mode){
                case "diff":
                    d = d1[i][1] - d2[i][1];
                    break;
                case "abs":
                    d = Math.abs(d1[i][1] - d2[i][1]);
                    break;
                default:
                    d = 0;
            }
            r.push([d1[i][0],d]);
        }
        return r;
    }
    function createWaterfall(data, colors){ //convert waterfalldata to 4 Bars, d1 for fixed bars, d2 for invisible bar
        var d1 = [], d2 = [], d3 = [], d4 = [], p = 0, mn = Number.POSITIVE_INFINITY,i;  // d3 for negative bars and d4 for positive bars
        var dx = data;
        for(i = 0; i < dx.length; i++) {
            if(dx[i][2]){
                if(typeof dx[i][1] === "undefined") { d1.push([i,p]); }
                else { d1.push([i,dx[i][1]]); p = dx[i][1]; }
            } 
            else{ 
                if(dx[i][1] > 0) { d4.push([i,- dx[i][1]]);p = p + dx[i][1];d2.push([i,p]);d3.push([i,0]);}
                else {d3.push([i,- dx[i][1]]);p = p + dx[i][1];d2.push([i,p]);}
            }
            mn = Math.min(mn,p);
        }
        var ticks = [];
        for(i = 0; i < data.length; i++){ ticks.push([i,data[i][0]]);}
        var dr = { 
            data: [
            { data: d1, color: colors.fixed },
            { data: d2, bars: { show: false }, lines: { show: false } },
            { data: d3, color: colors.negative },
            { data: d4, color: colors.positive}
            ],
            ticks: ticks,
            yaxismin: mn
        };
        return dr;
    }
    function avg(data,range){
        var r = [],rd = [],i1,s;
        for(var i = 0; i < data.length; i++){
            if(i < range){ i1 = 0;} else{ i1 = i - range + 1;}
            rd = [];
            rd.push(data[i][0]);
            for(var k = 1; k < data[i].length; k++){
                s = 0;
                for(var j = i1; j <= i; j++){ s += data[j][k];}
                rd.push(s / (i - i1 + 1));
            }
            r.push(rd);
        }
        return r;
    }
    function max(data,range){
        var r = [], rd = [], i1, mx;
        for(var i = 0; i < data.length; i++){
            if(i < range) {i1 = 0;} else {i1 = i - range + 1;}
            rd = [];
            rd.push(data[i][0]);
            for(var k = 1; k < data[i].length; k++){
                mx = - Number.MAX_VALUE;
                for(var j = i1; j <= i; j++){ if(data[j][k] > mx){ mx = data[j][k]; } }
                rd.push(mx);
            }
            r.push(rd);
        }
        return r;
    }
    function min(data,range){
        var r = [], rd = [], i1, mn;
        for(var i = 0; i < data.length; i++){
            if(i < range){ i1 = 0;} else{ i1 = i - range + 1;}
            rd = [];
            rd.push(data[i][0]);
            for(var k = 1; k < data[i].length; k++){
                mn = Number.MAX_VALUE;
                for(var j = i1; j <= i; j++){ if(data[j][k] < mn){ mn = data[j][k]; } }
                rd.push(mn);
            }
            r.push(rd);
        }
        return r;
    }
    function sort(data,sortOrder,sortfnc){
        var d = [];
        for(var i = 0; i < data.length; i++){ d.push(data[i]);}
        if(sortfnc){ d.sort(sortfnc); }
        else{ 
            if (sortOrder === "a"){ d.sort(mysorta); } else { d.sort(mysortd); }
        }
        return d;
        function mysorta(a,b){ return a[1] - b[1]; }
        function mysortd(a,b){ return b[1] - a[1]; }
    }
    function sortTicks(data,sortOrder,sortfnc){
        var d = sort(data,sortOrder,sortfnc);
        for(var i = 0; i < d.length; i++){d[i][0] = i; }
        return { data:d, ticks:getTicks(d) };
    }
    function pareto(data,otherLabel,showOthers,topN,topPercent){
        var d = [],othersLabel="Others",showothers = true,i,dn = [];
        d = sort(data,"d");
        if(otherLabel.length > 0){ othersLabel = otherLabel;}
        showothers = showOthers;
        if(topN){
            var s;
            for(i = 0;i < topN; i++){ dn.push(d[i]); }
            s = 0;
            for(i = topN;i < d.length; i++){ s+=d[i][1]; }
            if(showothers){ dn.push([topN, s,othersLabel]);}
            d = dn;
        }
        else if(topPercent){
            var datasum = 0, datar = 0, datao = 0,j;
            for(i = 0; i < d.length;i++){ datasum += d[i][1];}
            datasum = datasum * topPercent / 100;
            for(i = 0; i < d.length; i++){ 
                if (datar < datasum) {
                    dn.push(d[i]);
                    datar += d[i][1];
                    j = i;
                }
                else{ datao += d[i][1]; }
            }
            j++;
            if(showothers){ dn.push([j,datao,othersLabel]);}
            d = dn;
        }
        for(i = 0; i < d.length; i++){d[i][0] = i; }
        return { data:d, ticks:getTicks(d) };
    }    
    function getTicks(d){
        var t = [];
        for(var i = 0; i < d.length; i++){
            if(d[i][2]){ t.push([d[i][0], d[i][2]]);} else{ t.push(d[i][0], d[i][0]);}
        }
        return t;
    }
    function normalize(data){
        var minmax, d;var r = [];
        minmax = getMinMax(data);
        for(var i = 0; i < data.length; i++){
            d = (data[i][1] - minmax.min) / minmax.diff * 100;
            r.push([data[i][0],d]);
        }
        return r;
    }
    function combineData(data,ticks){
        var r = [];
        for(var i = 0; i < data.length; i++){
            var s = [];
            for(var j = 0; j < data[i].length; j++){
                var d = [ ticks[j], data[i][j] ];
                s.push(d);
            }
            r.push(s);
        }
        return r;
    }  

    function createFont(placeholder){
        var f = {
            style: placeholder.css("font-style"),
            size: Math.round(0.8 * (+placeholder.css("font-size").replace("px", "") || 13)),
            variant: placeholder.css("font-variant"),
            weight: placeholder.css("font-weight"),
            family: placeholder.css("font-family")
        };
        return f;
    }
    function createColors(options,neededColors){
        // this is copied code from jquery.flot.js in fillInSeriesOptions
        var c, colors = [], colorPool = options.colors,
            colorPoolSize = colorPool.length, variation = 0;
        for(var i = 0; i < colorPoolSize; i++){ colors[i] = colorPool[i]; }
        if(colorPoolSize < neededColors){
            for (i = colorPoolSize; i < neededColors; i++) {
                c = $.color.parse(colorPool[i % colorPoolSize] || "#666");
                if (i % colorPoolSize === 0 && i) {
                    if (variation >= 0) {
                        if (variation < 0.5) { variation = -variation - 0.2; } else{ variation = 0;}
                    }
                    else {variation = -variation;}
                }
                colors[i] = c.scale('rgb', 1 + variation).toString();
            }
        }
        return colors;
    }
    function getColor(colorData){ //based on a patch from Martin Thorsen Ranang from Nov 2012
        var c;
        if(typeof colorData === "object"){
            if(typeof colorData.dataIndex !== "undefined"){
                if(typeof colorData.serie.data[colorData.dataIndex].color !== "undefined"){ 
                    c = getColorL(colorData.serie.data[colorData.dataIndex].color);
                }
                else{ c = colorData.colors[colorData.dataIndex]; }
            }
            else{
                if(typeof colorData.serieIndex !== "undefined"){
                    if(typeof colorData.serie.color !== "undefined"){ c = getColorL(colorData.serie.color);} 
                    else{ c = colorData.colors[colorData.serieIndex];}
                }
                else{
                    if(typeof colorData.color !== "undefined"){c = getColorL(colorData.color);}
                    else {c = "darkgreen"; }
                }
            }
        }
        else{ c = getColorL(colorData); }
        return c;
        function getColorL(color){
            var c; 
            if(typeof color === "object"){ 
                if(typeof color.image !== "undefined"){
                    c = colorData.ctx.createPattern(color.image,color.repeat);
                }
                else{
                    if(colorData.radius){
                        c = colorData.ctx.createRadialGradient(colorData.left,colorData.top,0,
                            colorData.left,colorData.top,colorData.radius);  
                    }
                    else { c = colorData.ctx.createLinearGradient(0,0,colorData.width,colorData.height);}
                    for(var i = 0; i < color.colors.length; i++){
                        var cl = color.colors[i];
                        if(typeof cl !== "string"){
                            var co = $.color.parse(colorData.defaultColor);
                            if(color.brightness !== null){ cl = co.scale("rgb",color.brightness);}
                            if(color.opacity !== null){ co *= color.opacity;}
                            cl = co.toString();
                        }
                        c.addColorStop(i / (color.colors.length - 1),cl);
                    }
                }    
            }
            else{ if(typeof color === "string"){ c = color; } else { c = colorData.colors[color]; } }
            return c;
        }
    }
    function loadImages(images,maxWait,callback){
        var loadedImg = {},defs = [];
        for(var i = 0; i < images.length; i++){ defs.push(loadImage(images[i])); }
        $.when.apply(null,defs).then(function(){callback(loadedImg);});
        function loadImage(img){
            var dfd = $.Deferred(),t,url;
            url = img.path + img.name + "." + img.type;
            t = setInterval(function(){clearInterval(t);dfd.reject();},maxWait);
            $('<img />').attr('src',url).load(loaded).error(errorFound);
            return dfd.promise();
            function loaded(){ loadedImg[img.name] = this;dfd.resolve();}
            function errorFound(e,f,g){console.log(url,e); loadedImg[img.name] = null;dfd.reject();}    
        }
    } 
    function getCanvases(placeholder){
        var canvases = {
            background:$(placeholder).children(".flot-background"),
            base:$(placeholder).children(".flot-base"),
            overlay:$(placeholder).children(".flot-overlay")
        };
        return canvases;
    }
    function extendEmpty(org,ext){
        for(var i in ext){
            if(!org[i]){ org[i] = ext[i];}
            else{
                if(typeof ext[i] === "object"){
                    extendEmpty(org[i],ext[i]);
                }   
            }
        }
    }
    
    function drawLines(plot,lines){
        var offset,series,ctx;
        offset = plot.getPlotOffset();
        series = plot.getData();
        ctx = plot.getCanvas().getContext("2d");
        ctx.translate(offset.left,offset.top);
        for(var i = 0; i < lines.length; i++){
            var from = series[lines[i].from.seriesIndex], to = series[lines[i].to.seriesIndex];
            var fl = lines[i].from, tl = lines[i].to;
            if(!fl.dataFieldX){ fl.dataFieldX = 0;}
            if(!fl.dataFieldY){ fl.dataFieldY = 1;}
            if(!tl.dataFieldX){ tl.dataFieldX = 0;}
            if(!tl.dataFieldY){ tl.dataFieldY = 1;}
            var fromPos = {xaxis:from.xaxis, yaxis:from.yaxis, x:from.data[fl.dataIndex][fl.dataFieldX], y:from.data[fl.dataIndex][fl.dataFieldY]}, 
                toPos = {xaxis:to.xaxis, yaxis:to.yaxis, x:to.data[tl.dataIndex][tl.dataFieldX], y:to.data[tl.dataIndex][tl.dataFieldY]},
                lineStyle = {strokeStyle:"red", lineWidth:5};
            drawLine(plot,ctx,fromPos,toPos,lineStyle);     
        }
    }
    function drawLine(plot,ctx,fromPos,toPos,lineStyle){
        var xf,yf,xt,yt;
        xf = fromPos.xaxis.p2c(fromPos.x);
        yf = fromPos.yaxis.p2c(fromPos.y);
        xt = toPos.xaxis.p2c(toPos.x);
        yt = toPos.yaxis.p2c(toPos.y);
        ctx.beginPath();
        ctx.strokeStyle = lineStyle.strokeStyle;
        ctx.lineWidth = lineStyle.lineWidth;
        ctx.moveTo(xf,yf);
        ctx.lineTo(xt,yt);
        ctx.stroke();
    }
    function drawRect(plot,ctx,xaxis,yaxis,boxDim,boxStyle){
        var boxC = {x: xaxis.p2c(boxDim.x),y: yaxis.p2c(boxDim.y),
                width: xaxis.p2c((boxDim.x + boxDim.width)) - xaxis.p2c(boxDim.x),
                height: yaxis.p2c(boxDim.y + boxDim.height) - yaxis.p2c(boxDim.y)};
        switch(boxStyle.mode){
            case "image": drawImage(plot,ctx,boxC,boxStyle); break;
            case "color": drawColor(plot,ctx,boxC,boxStyle); break;
            case "userdefined": boxStyle.boxDraw(plot,ctx,boxC,boxStyle); break;
            default: drawColor(plot,ctx,boxC,boxStyle);
        }
        function drawImage(plot,ctx,boxC,boxStyle){
            var image = boxStyle.image;        
            if(typeof image !== "undefined"){ctx.drawImage(image,boxC.x,boxC.y,boxC.width(),boxC.height());} 
        }
        function drawColor(plot,ctx,boxC,boxStyle){
            color = getColor({ctx:ctx,color:boxStyle.color,left:boxC.x,top:boxC.y,height:boxC.height,width:boxC.width});
            ctx.fillStyle = color;
            ctx.fillRect(boxC.x,boxC.y,boxC.width,boxC.height);
        }
    }
    function drawCircle(plot,ctx,xaxis,yaxis,circle,circleStyle){
        var circleC = {x: xaxis.p2c(boxDim.x),y: yaxis.p2c(boxDim.y)}
    }
    $.plot.JUMlib = {};
    $.plot.JUMlib.library = {};
    $.plot.JUMlib.library.between = between;
    $.plot.JUMlib.library.getMinMax = getMinMax;
    $.plot.JUMlib.library.showHover = showHover;
    $.plot.JUMlib.library.showTooltip = showTooltip;
    $.plot.JUMlib.library.loadScripts = loadScripts;
    $.plot.JUMlib.library.loadJSON = loadJSON;
    $.plot.JUMlib.prepareData = {};
    $.plot.JUMlib.prepareData.createQuartile = createQuartile;
    $.plot.JUMlib.prepareData.createPercentile = createPercentile;
    $.plot.JUMlib.prepareData.createSimiliarity = createSimiliarity;
    $.plot.JUMlib.prepareData.createWaterfall = createWaterfall;
    $.plot.JUMlib.prepareData.avg = avg;
    $.plot.JUMlib.prepareData.max = max;
    $.plot.JUMlib.prepareData.min = min;
    $.plot.JUMlib.prepareData.sort = sort;
    $.plot.JUMlib.prepareData.sortTicks = sortTicks;
    $.plot.JUMlib.prepareData.pareto = pareto;
    $.plot.JUMlib.prepareData.normalize = normalize;
    $.plot.JUMlib.prepareData.combineData = combineData;
    $.plot.JUMlib.data = {};
    $.plot.JUMlib.data.createFont = createFont;
    $.plot.JUMlib.data.createColors = createColors;
    $.plot.JUMlib.data.getColor = getColor;
    $.plot.JUMlib.data.loadImages = loadImages;
    $.plot.JUMlib.data.getCanvases = getCanvases;
    $.plot.JUMlib.data.extendEmpty = extendEmpty;
    $.plot.JUMlib.drawing = {};
    $.plot.JUMlib.drawing.drawLine = drawLine;
    $.plot.JUMlib.drawing.drawRect = drawRect;
    $.plot.JUMlib.drawing.drawLines = drawLines;
    $.plot.plugins.push({
        init: function(){},
        options: { },
        name: pluginName,
        version: pluginVersion
    });
})(jQuery);