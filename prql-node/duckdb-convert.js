import prqljs from "prql-js";

// this converts to duckdb sql dialect so we can run it against duckdb
const prql = process.argv[2];

const opts = new prqljs.CompileOptions();
opts.target = "sql.duckdb";
opts.format = false;
opts.signature_comment = false;

// TODO - need valid prql from ui
const prql2 = `
from A
filter 'time' > @2021-01-01
take 1..20`

const sql = prqljs.compile(prql2, opts);

console.log(sql);
