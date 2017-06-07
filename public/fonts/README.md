## iconfont 使用指南

### 声明
* 项目中使用的iconfont版权归其作者所有
* iconfont来源：http://www.iconfont.cn/

### 使用方法
* 在阿里巴巴图标库中为项目添加成员,以便获取已使用图标
* 选择所需图标添加至项目
* 下载项目图标至本地
* 解压文件
  * 覆盖/public/fonts中iconfont.eot,iconfont.svg,iconfont.ttf,iconfont.woff文件
  * 覆盖/public/vendor/css中iconfont.css文件
  * 修改iconfont.css中url: 
    ```
    src: url('../fonts/iconfont.eot ...
    src: url('../fonts/iconfont.eot ...
    url('../fonts/iconfont.woff ...
    url('../fonts/iconfont.ttf ...
    url('../fonts/iconfont.svg ...
    ```
