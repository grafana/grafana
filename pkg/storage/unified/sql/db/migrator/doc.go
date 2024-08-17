// Package migrator ... TODO: high level, obvious description
//
// The main interfaces of this package are [Migrator], [Step], and [Statement].
// They are designed to be loosely coupled for ease of extensibility and testing
// purposes.
//
// The package will try to provide as much information in errors as possible, so
// as to collect all possible errors found when doing checks and only fail
// before doing any meaningful work (instead of returning upon the first error
// found). This is because development with migrations can be tricky sometimes,
// and we may need all the information we can gather as possible to provide the
// best support.
//
// DDL operations considered to be safe when used with this package's utilities:
//   - Creating a table or an index.
//   - Dropping an index.
//   - Adding a column with a default value to an existing table.
//   - Renaming a table, an index or a column.
//
// Considerations for backwards compatibility:
//   - Don't create any other top level database objects other than tables and
//     indexes.
//   - Never use the same name for the top level database objects mentioned
//     above. Consider them to share the same namespace.
//   - Never drop tables or columns once added to production.
//   - Never change the type of a column once added to production.
//   - Never change constraints of a column once added to production. Very few
//     exceptions may apply, and under very strict conditions, and may not be
//     worth the effort, so use application logic by default.
//
// Considerations for database interoperability that are enforced by this
// package:
//  1. Combininig multiple SQL statements in a single database call. Support for
//     this is patchy and requires great considerations. The saved roundtrips
//     are not worth for the migrations use case.
//  2. Avoid unquoted identifiers (i.e. table names, column names, index names,
//     etc.). TODO: explain this
//  3. Table constraints and other table features:
//     - Foreign Keys are not supported by all engines, and how they work
//     differs in ways that are hard to predict. Replace them with application
//     logic with appropriate testing.
//     - Unique Key constraints ... TODO: example of PostgreSQL treating
//     specially this
//     - Don't use Primary Keys. Instead, create a separate Unique Index and set
//     all its columns to be NOT NULL. This can help change indexing without
//     using ALTER TABLE. Some database systems treat Primary Keys differently
//     (like PostgrerSQL). TODO: add more details
//     - Don't use CHECK constraints, they are hard to make consistent across
//     all implementations. TODO: some exceptions may apply, which could be
//     added as extensions of this package after VERY CAREFUL design and reading
//     lots of docs
//     - Other: just don't (for example, partitions, remote tables, etc.).
//  4. Indexes:
//     - Only use column names, don't use expressions.
//     - Avoid indexing parameters and specific algorithms.
//     - Avoid partial indexes, not all engines support them. TODO: may have a
//     - Other: TODO
//     sensitive workaround, but not all considerations were researched yet.
//  5. Column constraints: anything else other than NULL/NOT NULL/DEFAULT. TODO:
//     explain.
//  6. Column data types other than the ones provided in this package:
//     - Unsigned integers are not supported in all databases, most notably in
//     PostgreSQL, so avoid them.
//  7. Special note about date, time and timestamp column data types: native
//     types can have very intricate and surprising logic, and it will be very
//     hard to make that logic match among different database implementations.
//     Consider the following alternatives instead:
//     - Store timestamps as a BIGINT representing a Unix Time.
//     - If sub-second precision is needed, add an additional BIGINT column to
//     represent nanoseconds.
//     - If timezone is needed, add a new column for it. Prefer a column of type
//     TEXT or an appropriately sized VARCHAR/CHAR, so that the timezone can be
//     stored in a IANA timezone db string (like
//     "America/Argentina/Buenos_Aires") to account for daylight saving and
//     political timezone decisions in the region. If you don't have a
//     colloquial string and only have the time offset as a number instead (like
//     just UTC-3), convert the offset to seconds and then to string, and then
//     add the logic in your application to handle it (Go has the
//     `time.FixedZone` function to help with this).
//
// TODO: add recommendations about DML to use a separate table for each created
// table to log all changed rows for reference. In a followup version, we could
// provide utilities to automate some parts of this.
package migrator
