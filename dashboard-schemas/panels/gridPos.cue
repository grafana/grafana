package panels

_gridPos: {
	// Panel height.
	h?: int > 0 | *9
	// Panel width.
	w?: int > 0 <= 24 | *12
	// Panel x position.
	x?: int >= 0 < 24 | *0
	// Panel y position.
	y?: int >= 0 | *0
}
