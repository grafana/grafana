import { readFileSync } from "fs";
import { Table } from "apache-arrow";

const arrow = readFileSync("../dataframe/dataframe.arrow");
const table = Table.from([arrow]);

console.log(JSON.stringify(table));
