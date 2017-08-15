## quill 使用方法

* 1.引入模块
```
define(['ng-quill'],function(){})
```

* 2.html使用
```
<ng-quill-editor 
    class=""
    ng-model="绑定内容"
    modules="{toolbar: toolbarCon}"   //控制toolbar显示、隐藏以及自定义toolbar
    read-only="readOnly"         //readOnly : true/false
    placeholder=""               //不写""的话有默认值
    on-editor-created="editorCreated(editor, knows.symptom)" //绑定事件，可选
>
</ng-quill-editor>
```

* 3.js中声明所需变量及函数
```
     $scope.绑定内容 = "quill";
     $scope.readOnly = false/true;
     $scope.toolbarCon  = [
      ['bold'],        // toggled buttons
      ['blockquote', 'code-block'],
      [{ 'header': 1 }, { 'header': 2 }],               // custom button values
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'indent': '-1'}, { 'indent': '+1' }],          // outdent/indent
      ['clean']                                         // remove formatting button
    ];
```
* 4.参考文档

    [quill](https://quilljs.com/docs/quickstart/)

    [ng-quill](https://github.com/KillerCodeMonkey/ng-quill)