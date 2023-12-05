import prqljs from "prql-js";

// this converts to duckdb sql dialect so we can run it against duckdb
const prql = process.argv[2];

const opts = new prqljs.CompileOptions();
opts.target = "sql.duckdb";
opts.format = false;
opts.signature_comment = false;

const sql = prqljs.compile(prql, opts);

console.log(sql);
