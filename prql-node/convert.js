import prqljs from "prql-js";

// this converts to generic sql so we can run the ast parser and get the table namews
const prql = process.argv[2];

const sql = prqljs.compile(prql);
console.log(sql);
