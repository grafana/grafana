/**
 * $Id: mxNetworks.js,v 1.0 2015/06/15 17:05:39 mate Exp $
 * Copyright (c) 2006-2015, JGraph Ltd
 */

//**********************************************************************************************************************************************************
//Bus
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeNetworksBus(bounds, fill, stroke, strokewidth)
{
	mxShape.call(this);
	this.bounds = bounds;
	this.fill = fill;
	this.stroke = stroke;
	this.strokewidth = (strokewidth != null) ? strokewidth : 1;
};

/**
* Extends mxShape.
*/
mxUtils.extend(mxShapeNetworksBus, mxShape);

mxShapeNetworksBus.prototype.cst = {
		SHAPE_BUS : 'mxgraph.networks.bus'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeNetworksBus.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, x, y, w, h);
	c.setShadow(false);
	this.foreground(c, x, y, w, h);
};

mxShapeNetworksBus.prototype.background = function(c, x, y, w, h)
{
	c.begin();
	c.moveTo(8, h * 0.5 + 10);
	c.arcTo(12, 12, 0, 0, 1, 8, h * 0.5 - 10);
	c.lineTo(w - 8, h * 0.5 - 10);
	c.arcTo(12, 12, 0, 0, 1, w - 8, h * 0.5 + 10);
	c.close();
	c.fillAndStroke();
};

mxShapeNetworksBus.prototype.foreground = function(c, x, y, w, h)
{
	c.setFillColor('#ffffff');
	c.begin();
	c.moveTo(w - 8, h * 0.5 - 10);
	c.arcTo(12, 12, 0, 0, 1, w - 8, h * 0.5 + 10);
	c.arcTo(12, 12, 0, 0, 1, w - 8, h * 0.5 - 10);
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxShapeNetworksBus.prototype.cst.SHAPE_BUS, mxShapeNetworksBus);

//**********************************************************************************************************************************************************
//Comm Link
//**********************************************************************************************************************************************************
function mxShapeNetworksCommLinkEdge()
{
	mxArrow.call(this);
};

mxUtils.extend(mxShapeNetworksCommLinkEdge, mxArrow);

mxShapeNetworksCommLinkEdge.prototype.paintEdgeShape = function(c, pts)
{
	// Base vector (between end points)
	var p0 = pts[0];
	var pe = pts[pts.length - 1];
	
	var dx = pe.x - p0.x;
	var dy = pe.y - p0.y;
	
	p0.x = p0.x + dx * 0.05;
	p0.y = p0.y + dy * 0.05;
	pe.x = pe.x - dx * 0.05;
	pe.y = pe.y - dy * 0.05;
	dx = pe.x - p0.x;
	dy = pe.y - p0.y;
	
	var dist = Math.sqrt(dx * dx + dy * dy);
	var nx = dx / dist;
	var ny = dy / dist;
	var midX = p0.x + dx * 0.5; 
	var midY = p0.y + dy * 0.5;
	
	var p1x = midX + nx * dist / 3 * 0.1 - ny / 3 * dist * 0.1;
	var p1y = midY + ny * dist / 3 * 0.1 + nx / 3 * dist * 0.1;
	var p2x = midX + nx * dist * 0.1 + ny * dist * 0.1;
	var p2y = midY + ny * dist * 0.1 - nx * dist * 0.1;

	var p3x = midX - nx * dist / 3 * 0.1 + ny / 3 * dist * 0.1;
	var p3y = midY - ny * dist / 3 * 0.1 - nx / 3 * dist * 0.1;
	var p4x = midX - nx * dist * 0.1 - ny * dist * 0.1;
	var p4y = midY - ny * dist * 0.1 + nx * dist * 0.1;

	c.begin();
	c.moveTo(p0.x, p0.y);
	c.lineTo(p2x, p2y);
	c.lineTo(p1x, p1y);
	c.lineTo(pe.x, pe.y);
	c.lineTo(p4x, p4y);
	c.lineTo(p3x, p3y);
	c.close();
	c.fillAndStroke();
};

//Registers the comm link edge
mxCellRenderer.registerShape('mxgraph.networks.comm_link_edge', mxShapeNetworksCommLinkEdge);
