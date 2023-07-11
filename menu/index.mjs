import generateMenuFile from "../menu-generator/config/menu/menu-generator/index.mjs";

generateMenuFile({
  basename: '/grafana',
  filePathName: '../public/build/menu.json', // 生成文件 menu.json 存放位置，相对当前文件的路径
  dataPathName: './data.mjs', // 原始数据地址，相对当前文件的路径
  metaUrl: import.meta.url, // 不要漏掉这个哦
  dataFileChangeDelay: 2*1000, // 非必填，data.mjs 改变后重新编译生成 menu.json 的消抖时间，默认3s，可能有点慢
});
