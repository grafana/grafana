#!/bin/sh

if test $# -lt 1
then
    echo "specify a file"
    exit 2
fi

if test ! -f $1 
then
cat <<!  > $1
package main

import (
  "github.com/ajstarks/svgo"
  "os"
)

var (
  width = 500
  height = 500
  canvas = svg.New(os.Stdout)
)

func background(v int) { canvas.Rect(0, 0, width, height, canvas.RGB(v, v, v)) }


func main() {
  canvas.Start(width, height)
  background(255)
  
  // your code here
  
  canvas.Grid(0, 0, width, height, 10, "stroke:black;opacity:0.1")
  canvas.End()
}
!
fi
$EDITOR $1
