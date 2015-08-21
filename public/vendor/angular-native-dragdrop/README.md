#Angular-DragDrop
[![npm version](http://img.shields.io/npm/v/angular-native-dragdrop.svg?style=flat)](https://npmjs.org/package/angular-native-dragdrop) 
[![Build status](http://img.shields.io/travis/angular-dragdrop/angular-dragdrop.svg?style=flat)](https://travis-ci.org/angular-dragdrop/angular-dragdrop)
[![Gitter](https://badges.gitter.im/Join Chat.svg)](https://gitter.im/ganarajpr/angular-dragdrop?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge)

Angular-DragDrop is a angular HTML5 Drag and Drop directive written in pure with no dependency on JQuery.

This is based on the work done by Jason Turim. While this [blog post](http://jasonturim.wordpress.com/2013/09/01/angularjs-drag-and-drop/) was the inspiration for creating a native Drag and Drop solution, the intention was to create something that was more generic. 

This implementation is mainly different from the one posted in the blog in the following areas : 

1. Angular-DragDrop does not create an isolate scope. This has huge benefits when it comes to working with other directives. **NOTE :** It also does not pollute the scope with any variables or functions.

2. It does not depend on any kind of an ID attribute ( being either present or generated on the fly ). 

3. It allows one to create channels on which different drag and drop directive combinations can work on in the same page ( more on this later ) . 

Pull requests are welcome.

[Documentation](http://angular-dragdrop.github.io/angular-dragdrop/)

#Looking for Active Contributors.

This repo needs active contributers and maintainers. If you are interested in being one of the people who would like to actively maintain this repo, please let me know. 



The MIT License

Copyright (c) 2014 Ganaraj P R, [Nebithi](http://www.nebithi.com)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
