const prqljs = require("prql-js");

prql = process.argv[2];
const sql = prqljs.compile(prql);
console.log(sql);
